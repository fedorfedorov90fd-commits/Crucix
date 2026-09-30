// RSS Лента новостей — Crucix с AI-оценками и диагностикой

class RSSFeed {
  constructor() {
    this.items = [];
    this.filteredItems = [];
    this.currentRegion = 'all';
    this.maxItems = 20;
    this.track = document.getElementById('feed-track');
    this.counter = document.getElementById('feed-counter');

    this.init();
  }

  async init() {
    this.setupControls();
    this.setupFilters();
    await this.loadRealNews();
    this.updateCounter();
    this.setupCopyButton();
  }

  setupControls() {
    const countSelect = document.getElementById('feed-count');
    if (countSelect) {
      countSelect.addEventListener('change', () => {
        this.maxItems = parseInt(countSelect.value);
        this.renderItems();
      });
    }
  }

  setupFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRegion = btn.dataset.filter;
        this.applyFilter();
      });
    });
  }

  async loadRealNews() {
    try {
      const response = await fetch('/api/rss/feeds');
      const data = await response.json();

      if (data.feeds && data.feeds.length > 0) {
        this.items = data.feeds.map(item => ({
          id: item.id || 'news-' + Math.random(),
          title: item.title || 'Без заголовка',
          source: item.source || item.category || 'Источник',
          region: this.detectRegion(item),
          regionName: this.getRegionEmoji(this.detectRegion(item)),
          date: item.collectedAt || item.pubDate || new Date().toISOString(),
          url: item.link || '#',
          summary: item.description || item.summary || 'Новость из RSS-ленты',
          ai_score: item.ai_score || null,
          ai_importance: item.ai_importance || 'unknown'
        }));

        await this.rateNewsWithAI();
        console.log('✅ Загружено новостей:', this.items.length);
      } else {
        console.log('⚠️ Нет реальных новостей, использую демо');
        this.useDemoNews();
      }
    } catch (e) {
      console.error('❌ Ошибка загрузки:', e);
      this.useDemoNews();
    }

    this.applyFilter();
  }

  async rateNewsWithAI() {
    const toRate = this.items.filter(item => item.ai_score === null).slice(0, 20);

    if (toRate.length === 0) return;

    try {
      console.log(`🤖 Оценка AI: ${toRate.length} новостей...`);

      const response = await fetch('/api/ai/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: toRate })
      });

      const data = await response.json();

      if (data.success && data.news) {
        for (const rated of data.news) {
          const item = this.items.find(i => i.id === rated.id);
          if (item) {
            item.ai_score = rated.ai_score;
            item.ai_importance = rated.ai_importance || 'normal';
          }
        }
        console.log('✅ AI оценки получены');
        this.renderItems();
      }
    } catch (e) {
      console.error('❌ Ошибка AI:', e);
    }
  }

  detectRegion(item) {
    const categories = {
      'США': 'us',
      'Европа': 'europe',
      'Африка': 'africa',
      'Ближний Восток': 'middle-east',
      'Латинская Америка': 'latin-america',
      'Азия': 'asia-pacific',
      'Энергетика': 'energy',
      'Правительство': 'government',
      'Аналитика': 'thinktank',
      'Прогнозы': 'forecast'
    };

    if (item.category) {
      for (const [key, value] of Object.entries(categories)) {
        if (item.category.includes(key)) return value;
      }
    }

    if (item.source) {
      const sourceMap = {
        'Reuters': 'world', 'AP': 'world', 'BBC': 'europe',
        'Al Jazeera': 'middle-east', 'TASS': 'world', 'РИА': 'world',
        'France 24': 'europe', 'CNN': 'us', 'Bloomberg': 'us',
        'Nikkei': 'asia-pacific', 'Xinhua': 'asia-pacific'
      };
      for (const [key, value] of Object.entries(sourceMap)) {
        if (item.source.includes(key)) return value;
      }
    }
    return 'world';
  }

  useDemoNews() {
    const sources = ['Reuters', 'AP News', 'BBC', 'Al Jazeera', 'TASS', 'France 24', 'CNN', 'Bloomberg'];
    const regions = ['world', 'us', 'europe', 'africa', 'middle-east', 'latin-america', 'asia-pacific'];
    const regionMap = {
      'world': '🌍 Мир', 'us': '🇺🇸 США', 'europe': '🇪🇺 Европа',
      'africa': '🌍 Африка', 'middle-east': '🏛 Ближний Восток',
      'latin-america': '🌎 Латинская Америка', 'asia-pacific': '🌏 Азиатско-Тихоокеанский'
    };
    const titles = [
      'Встреча лидеров G20 завершилась принятием декларации',
      'Цены на нефть выросли на фоне геополитической напряжённости',
      'Новый закон о кибербезопасности вступает в силу в ЕС',
      'Китай запустил новую космическую станцию',
      'ФРС повысила ключевую ставку до 5.5%',
      'В США зафиксирован рекордный уровень инфляции'
    ];

    this.items = [];
    for (let i = 0; i < 20; i++) {
      const region = regions[i % regions.length];
      this.items.push({
        id: 'demo-' + i,
        title: titles[i % titles.length] + (i > 3 ? ' (' + (i + 1) + ')' : ''),
        source: sources[i % sources.length],
        region: region,
        regionName: regionMap[region] || '🌍 Мир',
        date: new Date(Date.now() - i * 3600000).toISOString(),
        url: '#',
        summary: 'Демонстрационная новость для тестирования RSS-ленты',
        ai_score: Math.floor(Math.random() * 10),
        ai_importance: Math.random() > 0.7 ? 'critical' : Math.random() > 0.4 ? 'important' : 'normal'
      });
    }
  }

  applyFilter() {
    if (this.currentRegion === 'all') {
      this.filteredItems = [...this.items];
    } else if (this.currentRegion === 'critical') {
      this.filteredItems = this.items.filter(item =>
        item.ai_importance === 'critical' || (item.ai_score && item.ai_score >= 7)
      );
    } else {
      this.filteredItems = this.items.filter(item =>
        item.region === this.currentRegion
      );
      if (this.filteredItems.length === 0) {
        this.filteredItems = [...this.items];
      }
    }

    this.filteredItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.renderItems();
    this.updateCounter();
  }

  renderItems() {
    const container = document.getElementById('feedList');
    const loading = document.getElementById('loadingIndicator');
    loading.style.display = 'none';

    const items = this.filteredItems.slice(0, this.maxItems);

    if (items.length === 0) {
      container.innerHTML = '<div class="feed-empty">Нет новостей</div>';
      return;
    }

    let html = '';
    for (const item of items) {
      const time = new Date(item.date);
      const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const title = this.escapeHtml(item.title);
      const source = this.escapeHtml(item.source);
      const regionName = item.regionName || '📰';
      const summary = item.summary ? this.escapeHtml(item.summary) : '';

      const score = item.ai_score;
      let scoreClass = 'score-unknown';
      let scoreText = '?';

      if (score !== null && score !== undefined) {
        if (score >= 8) {
          scoreClass = 'score-critical';
          scoreText = score;
        } else if (score >= 5) {
          scoreClass = 'score-important';
          scoreText = score;
        } else {
          scoreClass = 'score-normal';
          scoreText = score;
        }
      }

      html += `
        <div class="feed-item ${scoreClass}" onclick="window.rssFeed?.showArticleModal('${title.replace(/'/g, "\\'")}', '${source.replace(/'/g, "\\'")}', '${(summary || '').replace(/'/g, "\\'")}')">
          <span class="feed-icon">${regionName}</span>
          <span class="feed-title">${title}</span>
          <span class="feed-source">${source}</span>
          <span class="feed-time">${timeStr}</span>
          <span class="feed-score">${scoreText}</span>
        </div>
      `;
    }

    container.innerHTML = html;
    window._feedItems = this.filteredItems;
    document.getElementById('newsCount').textContent = this.filteredItems.length;
  }

  showArticleModal(title, source, summary) {
    const existing = document.querySelector('.article-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'article-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    modal.innerHTML = `
      <div style="
        background: #1a1a2e;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 30px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 24px 80px rgba(0,0,0,0.8);
        position: relative;
      ">
        <button onclick="this.closest('.article-modal').remove()" style="
          position: sticky; top: 0; float: right;
          background: #f44336; color: #fff; border: none;
          border-radius: 4px; padding: 4px 12px;
          cursor: pointer; font-size: 18px;
        ">✕</button>
        <div style="font-size: 12px; color: #888; margin-bottom: 8px;">📰 ${source}</div>
        <h2 style="color: #fff; font-size: 20px; margin-bottom: 16px;">${title}</h2>
        <div style="color: #ccc; font-size: 15px; line-height: 1.6;">
          ${summary || 'Полный текст статьи доступен по ссылке.'}
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);">
          <button onclick="this.closest('.article-modal').remove()" style="
            background: #2196f3; color: #fff; border: none;
            border-radius: 4px; padding: 8px 16px;
            cursor: pointer; font-size: 13px;
          ">Закрыть</button>
        </div>
      </div>
    `;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateCounter() {
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = this.items.filter(item =>
      item.date && item.date.startsWith(today)
    );
    if (this.counter) {
      this.counter.textContent = `Новостей за сегодня: ${todayItems.length}`;
    }
  }

  getRegionEmoji(region) {
    const map = {
      'world': '🌍', 'us': '🇺🇸', 'europe': '🇪🇺',
      'africa': '🌍', 'middle-east': '🏛', 'latin-america': '🌎',
      'asia-pacific': '🌏', 'energy': '⚡', 'government': '🏛',
      'thinktank': '🧠', 'forecast': '📊'
    };
    return map[region] || '📰';
  }

  // ============================================================
  // НАСТРОЙКА КНОПКИ КОПИРОВАТЬ С ДИАГНОСТИКОЙ
  // ============================================================
  setupCopyButton() {
    const copyBtn = document.getElementById('copy-btn');
    const dropdown = document.getElementById('copyDropdown');

    if (copyBtn) {
      copyBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
      });
    }

    document.addEventListener('click', function() {
      if (dropdown) dropdown.classList.remove('show');
    });

    document.querySelectorAll('#copyDropdown button[data-format]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const format = this.dataset.format;
        if (dropdown) dropdown.classList.remove('show');

        if (format === 'diagnostic') {
          this.runDiagnostic();
        } else {
          this.copyPageData(format);
        }
      }.bind(this));
    }.bind(this));
  }

  // ============================================================
  // ДИАГНОСТИКА RSS-СТРАНИЦЫ
  // ============================================================
  async runDiagnostic() {
    const panel = document.getElementById('diagnosticPanel');
    const content = document.getElementById('diagnosticContent');
    const badge = document.getElementById('diagBadge');

    try {
      const diagData = await this.collectDiagnosticData();

      content.innerHTML = this.generateDiagnosticHTML(diagData);
      panel.classList.add('open');

      const hasErrors = diagData.errors.length > 0 || diagData.apiStatus === 'error';
      if (hasErrors) {
        badge.textContent = '⚠️ ' + (diagData.errors.length || 'ошибка');
        badge.style.color = '#ef4444';
      } else {
        badge.textContent = '✅ OK';
        badge.style.color = '#4ade80';
      }

      this.showNotification('Диагностика завершена');
    } catch (e) {
      content.innerHTML = `
        <div class="diag-section">
          <div class="diag-section-title status-error">Ошибка диагностики</div>
          <pre>${e.message}</pre>
        </div>
      `;
      panel.classList.add('open');
      this.showNotification('Ошибка диагностики');
    }
  }

  async collectDiagnosticData() {
    const startTime = performance.now();
    const errors = window.__consoleErrors || [];

    let apiStatus = 'unknown';
    let apiData = null;
    try {
      const res = await fetch('/api/rss/feeds');
      if (res.ok) {
        apiStatus = 'ok';
        apiData = await res.json();
      } else {
        apiStatus = 'error';
        errors.push('API вернул статус ' + res.status);
      }
    } catch (e) {
      apiStatus = 'error';
      errors.push('Ошибка API: ' + e.message);
    }

    let feedItems = window._feedItems || [];
    if (apiData) {
      if (apiData.feeds) feedItems = apiData.feeds;
      else if (Array.isArray(apiData)) feedItems = apiData;
      else if (apiData.data) feedItems = apiData.data;
      else if (apiData.items) feedItems = apiData.items;
    }

    const activeFilter = document.querySelector('.filter-btn.active');
    const currentFilter = activeFilter ? activeFilter.dataset.filter : 'all';

    const autoScrollToggle = document.getElementById('autoScrollToggle');
    const speedSlider = document.getElementById('speedSlider');

    const debugOpen = document.getElementById('debugPanel').classList.contains('open');

    const feedContainer = document.getElementById('feedContainer');
    const feedList = document.getElementById('feedList');

    const loadTime = performance.now() - startTime;

    const storageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      storageKeys.push(localStorage.key(i));
    }

    const sessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      sessionKeys.push(sessionStorage.key(i));
    }

    const sources = new Set();
    feedItems.forEach(item => {
      if (item.source) sources.add(item.source);
      if (item.author) sources.add(item.author);
    });

    const regions = new Set();
    feedItems.forEach(item => {
      if (item.region) regions.add(item.region);
      if (item.categories) {
        item.categories.forEach(c => regions.add(c));
      }
    });

    const pageChecks = {
      hasFeedItems: feedItems.length > 0,
      hasFilterButtons: document.querySelectorAll('.filter-btn').length > 0,
      hasScrollControls: document.getElementById('autoScrollToggle') !== null,
      hasRefreshBtn: document.querySelector('.refresh-btn') !== null,
      hasFeedContainer: feedContainer !== null,
      hasFeedList: feedList !== null,
    };

    const computedStyles = {};
    const styleElements = ['body', '.feed-item', '.feed-item .title', '.feed-item .summary'];
    styleElements.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        const styles = window.getComputedStyle(el);
        computedStyles[sel] = {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          lineHeight: styles.lineHeight,
          padding: styles.padding,
          margin: styles.margin,
          border: styles.border,
          borderRadius: styles.borderRadius,
        };
      }
    });

    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      windowSize: { width: window.innerWidth, height: window.innerHeight },
      apiStatus,
      apiData: apiData ? { total: feedItems.length, first: feedItems.length > 0 ? feedItems[0] : null } : null,
      feedItems: {
        total: feedItems.length,
        sources: Array.from(sources).slice(0, 20),
        regions: Array.from(regions).slice(0, 20),
        sample: feedItems.slice(0, 5).map(item => ({
          title: item.title || item.name || 'Без названия',
          source: item.source || item.author || 'Неизвестный источник',
          date: item.date || null,
          region: item.region || null,
        })),
      },
      state: {
        currentFilter,
        autoScroll: autoScrollToggle ? autoScrollToggle.checked : null,
        speed: speedSlider ? speedSlider.value : null,
        debugOpen,
      },
      pageChecks,
      computedStyles,
      storage: {
        localStorage: storageKeys,
        sessionStorage: sessionKeys,
      },
      errors: errors.slice(0, 20),
      performance: { loadTime: Math.round(loadTime) },
    };
  }

  generateDiagnosticHTML(diag) {
    const hasErrors = diag.errors.length > 0 || diag.apiStatus === 'error';
    const statusClass = hasErrors ? 'status-error' : 'status-ok';

    let html = '';

    html += `
      <div class="diag-section">
        <div class="diag-section-title">Общий статус</div>
        <div class="diag-row">
          <span class="key">Состояние</span>
          <span class="value ${statusClass}">${hasErrors ? 'Есть проблемы' : 'OK'}</span>
        </div>
        <div class="diag-row">
          <span class="key">Новостей в ленте</span>
          <span class="value">${diag.feedItems.total}</span>
        </div>
        <div class="diag-row">
          <span class="key">Уникальных источников</span>
          <span class="value">${diag.feedItems.sources.length}</span>
        </div>
        <div class="diag-row">
          <span class="key">Регионов</span>
          <span class="value">${diag.feedItems.regions.length}</span>
        </div>
        <div class="diag-row">
          <span class="key">Время диагностики</span>
          <span class="value">${diag.performance.loadTime}ms</span>
        </div>
      </div>
    `;

    html += `
      <div class="diag-section">
        <div class="diag-section-title">API</div>
        <div class="diag-row">
          <span class="key">Статус</span>
          <span class="value ${diag.apiStatus === 'ok' ? 'status-ok' : 'status-error'}">${diag.apiStatus === 'ok' ? 'Доступен' : 'Ошибка'}</span>
        </div>
        <div class="diag-row">
          <span class="key">Записей получено</span>
          <span class="value">${diag.feedItems.total}</span>
        </div>
      </div>
    `;

    html += `
      <div class="diag-section">
        <div class="diag-section-title">Состояние страницы</div>
        <div class="diag-row">
          <span class="key">Текущий фильтр</span>
          <span class="value">${diag.state.currentFilter}</span>
        </div>
        <div class="diag-row">
          <span class="key">Автопрокрутка</span>
          <span class="value">${diag.state.autoScroll !== null ? (diag.state.autoScroll ? 'Вкл' : 'Выкл') : '—'}</span>
        </div>
        <div class="diag-row">
          <span class="key">Скорость прокрутки</span>
          <span class="value">${diag.state.speed || '—'}</span>
        </div>
        <div class="diag-row">
          <span class="key">Панель отладки</span>
          <span class="value">${diag.state.debugOpen ? 'Открыта' : '—'}</span>
        </div>
      </div>
    `;

    html += `
      <div class="diag-section">
        <div class="diag-section-title">Проверки страницы</div>
        ${Object.entries(diag.pageChecks).map(([key, val]) => `
          <div class="diag-row">
            <span class="key">${key}</span>
            <span class="value">${val ? '✅' : '❌'}</span>
          </div>
        `).join('')}
      </div>
    `;

    if (diag.feedItems.sources.length > 0) {
      html += `
        <div class="diag-section">
          <div class="diag-section-title">Источники (${diag.feedItems.sources.length})</div>
          <pre>${diag.feedItems.sources.join(', ')}</pre>
        </div>
      `;
    }

    if (diag.feedItems.regions.length > 0) {
      html += `
        <div class="diag-section">
          <div class="diag-section-title">Регионы (${diag.feedItems.regions.length})</div>
          <pre>${diag.feedItems.regions.join(', ')}</pre>
        </div>
      `;
    }

    if (diag.feedItems.sample.length > 0) {
      html += `
        <div class="diag-section">
          <div class="diag-section-title">Примеры новостей (${diag.feedItems.sample.length})</div>
          <pre>${diag.feedItems.sample.map(item =>
            `${item.title} (${item.source})${item.region ? ' — ' + item.region : ''}`
          ).join('\n')}</pre>
        </div>
      `;
    }

    if (diag.errors.length > 0) {
      html += `
        <div class="diag-section">
          <div class="diag-section-title status-error">Ошибки (${diag.errors.length})</div>
          <pre>${diag.errors.join('\n')}</pre>
        </div>
      `;
    } else {
      html += `
        <div class="diag-section">
          <div class="diag-section-title status-ok">Ошибок нет</div>
        </div>
      `;
    }

    html += `
      <div class="diag-section">
        <div class="diag-section-title">Storage</div>
        <div class="diag-row">
          <span class="key">localStorage ключей</span>
          <span class="value">${diag.storage.localStorage.length}</span>
        </div>
        <div class="diag-row">
          <span class="key">sessionStorage ключей</span>
          <span class="value">${diag.storage.sessionStorage.length}</span>
        </div>
        ${diag.storage.localStorage.length > 0 ? `
          <div class="diag-row" style="margin-top:4px;">
            <span class="key">localStorage</span>
            <span class="value" style="font-size:10px;color:#4a5a6a;">${diag.storage.localStorage.join(', ')}</span>
          </div>
        ` : ''}
      </div>
    `;

    html += `
      <div class="diag-section">
        <div class="diag-section-title">CSS (вычисленные стили)</div>
        <pre>${JSON.stringify(diag.computedStyles, null, 2)}</pre>
      </div>
    `;

    html += `
      <div class="diag-section">
        <div class="diag-section-title">Система</div>
        <div class="diag-row">
          <span class="key">URL</span>
          <span class="value" style="font-size:10px;color:#4a5a6a;">${diag.url}</span>
        </div>
        <div class="diag-row">
          <span class="key">Размер окна</span>
          <span class="value">${diag.windowSize.width}×${diag.windowSize.height}</span>
        </div>
        <div class="diag-row">
          <span class="key">User Agent</span>
          <span class="value" style="font-size:10px;color:#4a5a6a;">${diag.userAgent.slice(0, 80)}...</span>
        </div>
      </div>
    `;

    return html;
  }

  // ============================================================
  // КОПИРОВАНИЕ ДАННЫХ (улучшенная версия)
  // ============================================================
  copyPageData(format) {
    const timestamp = new Date().toLocaleString();
    const pageTitle = document.querySelector('.page-title')?.textContent || document.title || 'Без заголовка';
    const url = window.location.href;
    const windowSize = window.innerWidth + '×' + window.innerHeight;

    let report = '';

    switch(format) {
      case 'text':
        report = this.generateTextReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'markdown':
        report = this.generateMarkdownReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'json':
        report = this.generateJSONReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'csv':
        report = this.generateCSVReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'diagnostic':
        this.runDiagnostic();
        return;
      case 'dom':
        report = this.generateDOMReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'storage':
        report = this.generateStorageReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'api':
        report = this.generateAPIReport(timestamp, pageTitle, url, windowSize);
        break;
      case 'all':
        report = this.generateAllReport(timestamp, pageTitle, url, windowSize);
        break;
      default:
        report = this.generateTextReport(timestamp, pageTitle, url, windowSize);
    }

    this.copyToClipboard(report, format);
  }

  generateTextReport(timestamp, pageTitle, url, windowSize) {
    const items = window._feedItems || [];
    let report = '=== CRUCIX — СНАПШОТ RSS СТРАНИЦЫ ===\n';
    report += 'Дата: ' + timestamp + '\n';
    report += 'URL: ' + url + '\n';
    report += 'Размер окна: ' + windowSize + '\n';
    report += 'Всего новостей: ' + items.length + '\n\n';

    const activeFilter = document.querySelector('.filter-btn.active');
    const currentFilter = activeFilter ? activeFilter.dataset.filter : 'all';
    report += '--- СОСТОЯНИЕ СТРАНИЦЫ ---\n';
    report += 'Текущий фильтр: ' + currentFilter + '\n';
    const autoScroll = document.getElementById('autoScrollToggle');
    report += 'Автопрокрутка: ' + (autoScroll ? (autoScroll.checked ? 'Вкл' : 'Выкл') : '—') + '\n';
    const speed = document.getElementById('speedSlider');
    report += 'Скорость прокрутки: ' + (speed ? speed.value : '—') + '\n\n';

    report += '--- НОВОСТИ (' + items.length + ') ---\n';
    if (items.length === 0) {
      report += 'Нет новостей для отображения\n';
    } else {
      items.forEach((item, i) => {
        const title = item.title || item.name || 'Без названия';
        const source = item.source || 'Неизвестный источник';
        const date = item.date ? new Date(item.date).toLocaleString('ru-RU') : '—';
        const summary = item.summary || item.description || item.content || '';
        const urlLink = item.url || item.link || '#';
        const region = item.region || 'world';
        report += (i + 1) + '. ' + title + '\n';
        report += '   Источник: ' + source + '\n';
        report += '   Дата: ' + date + '\n';
        report += '   Регион: ' + region + '\n';
        if (summary) report += '   Описание: ' + summary + '\n';
        report += '   Ссылка: ' + urlLink + '\n\n';
      });
    }

    report += '\n=== CRUCIX OSINT TERMINAL ===\n';
    report += 'https://github.com/fedorfedorov90fd-commits/Crucix';

    return report;
  }

  generateMarkdownReport(timestamp, pageTitle, url, windowSize) {
    const items = window._feedItems || [];
    let md = '# CRUCIX — СНАПШОТ RSS СТРАНИЦЫ\n\n';
    md += '**Дата:** ' + timestamp + '\n';
    md += '**URL:** ' + url + '\n';
    md += '**Размер окна:** ' + windowSize + '\n';
    md += '**Всего новостей:** ' + items.length + '\n\n';

    md += '## Новости\n\n';
    if (items.length === 0) {
      md += 'Нет новостей для отображения\n';
    } else {
      items.forEach((item, i) => {
        const title = item.title || item.name || 'Без названия';
        const source = item.source || 'Неизвестный источник';
        const date = item.date ? new Date(item.date).toLocaleString('ru-RU') : '—';
        const summary = item.summary || item.description || item.content || '';
        const urlLink = item.url || item.link || '#';
        md += '### ' + (i + 1) + '. ' + title + '\n';
        md += '- **Источник:** ' + source + '\n';
        md += '- **Дата:** ' + date + '\n';
        md += '- **Регион:** ' + (item.region || 'world') + '\n';
        if (summary) md += '- **Описание:** ' + summary + '\n';
        md += '- **Ссылка:** ' + urlLink + '\n\n';
      });
    }

    return md;
  }

  generateJSONReport(timestamp, pageTitle, url, windowSize) {
    const items = window._feedItems || [];
    const activeFilter = document.querySelector('.filter-btn.active');
    const currentFilter = activeFilter ? activeFilter.dataset.filter : 'all';
    const autoScroll = document.getElementById('autoScrollToggle');
    const speed = document.getElementById('speedSlider');

    return JSON.stringify({
      meta: {
        timestamp,
        url,
        windowSize,
        pageTitle,
        totalItems: items.length,
        filter: currentFilter,
        autoScroll: autoScroll ? autoScroll.checked : null,
        speed: speed ? speed.value : null,
      },
      items: items.map(item => ({
        title: item.title || item.name || 'Без названия',
        source: item.source || 'Неизвестный источник',
        date: item.date || null,
        region: item.region || 'world',
        summary: item.summary || item.description || item.content || '',
        url: item.url || item.link || '#',
        ai_score: item.ai_score || null,
        ai_importance: item.ai_importance || 'unknown',
      })),
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  generateCSVReport(timestamp, pageTitle, url, windowSize) {
    const items = window._feedItems || [];
    let csv = '№,Заголовок,Источник,Дата,Регион,Описание,Ссылка\n';
    if (items.length === 0) {
      csv += 'Нет новостей для отображения\n';
    } else {
      items.forEach((item, i) => {
        const title = (item.title || item.name || 'Без названия').replace(/,/g, ';');
        const source = (item.source || 'Неизвестный источник').replace(/,/g, ';');
        const date = item.date ? new Date(item.date).toLocaleString('ru-RU') : '—';
        const region = item.region || 'world';
        const summary = (item.summary || item.description || item.content || '').replace(/,/g, ';');
        const urlLink = item.url || item.link || '#';
        csv += (i + 1) + ',"' + title + '","' + source + '","' + date + '","' + region + '","' + summary + '","' + urlLink + '"\n';
      });
    }
    return csv;
  }

  generateDOMReport(timestamp, pageTitle, url, windowSize) {
    let report = '=== DOM-ДЕРЕВО ===\n';
    report += 'Дата: ' + timestamp + '\n';
    report += 'URL: ' + url + '\n\n';
    report += document.documentElement.outerHTML;
    return report;
  }

  generateStorageReport(timestamp, pageTitle, url, windowSize) {
    let report = '=== STORAGE ДАННЫЕ ===\n';
    report += 'Дата: ' + timestamp + '\n';
    report += 'URL: ' + url + '\n\n';

    report += '--- localStorage (' + localStorage.length + ' записей) ---\n';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      report += key + ': ' + value + '\n';
    }

    report += '\n--- sessionStorage (' + sessionStorage.length + ' записей) ---\n';
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const value = sessionStorage.getItem(key);
      report += key + ': ' + value + '\n';
    }

    report += '\n--- Cookies ---\n' + (document.cookie || 'нет');
    return report;
  }

  generateAPIReport(timestamp, pageTitle, url, windowSize) {
    let report = '=== API-ЗАПРОСЫ СТРАНИЦЫ ===\n';
    report += 'Дата: ' + timestamp + '\n';
    report += 'URL: ' + url + '\n\n';
    report += 'Основной запрос: /api/rss/feeds\n';
    report += 'Дополнительные: /api/ai/rate (при наличии)\n';
    return report;
  }

  generateAllReport(timestamp, pageTitle, url, windowSize) {
    let report = '=== CRUCIX — ПОЛНЫЙ ЭКСПОРТ ===\n\n';
    report += this.generateTextReport(timestamp, pageTitle, url, windowSize);
    report += '\n\n--- DOM ДЕРЕВО ---\n';
    report += this.generateDOMReport(timestamp, pageTitle, url, windowSize);
    report += '\n\n--- STORAGE ---\n';
    report += this.generateStorageReport(timestamp, pageTitle, url, windowSize);
    return report;
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================================
  copyToClipboard(text, format) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      if (btn) {
        btn.textContent = '✅ ' + format.toUpperCase();
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 КОПИРОВАТЬ ▼';
          btn.classList.remove('copied');
        }, 3000);
      }
      this.showNotification('Скопировано в формате ' + format.toUpperCase());
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showNotification('Скопировано в формате ' + format.toUpperCase());
    });
  }

  showNotification(msg) {
    document.querySelectorAll('.notification').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  window.rssFeed = new RSSFeed();

  // Перехват ошибок консоли
  window.__consoleErrors = [];
  const originalError = console.error;
  console.error = function(...args) {
    window.__consoleErrors.push(args.join(' '));
    if (window.__consoleErrors.length > 100) window.__consoleErrors.shift();
    originalError.apply(console, args);
  };
  window.addEventListener('error', function(e) {
    window.__consoleErrors.push(e.message + ' at ' + e.filename + ':' + e.lineno);
  });
});

// ============================================================
// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML
// ============================================================
function openHelp() {
  const pageId = window.location.pathname.replace(/^\/+/, "").replace(/\.html$/, "") || "rss-feed";
  const lang = localStorage.getItem('crucix-lang') || "ru";
  const helpFile = '/data/help/' + lang + '/' + pageId + '.txt';
  fetch(helpFile).then(res => res.text()).then(text => {
    alert(text || "Справка не найдена");
  }).catch(() => alert("Справка не найдена"));
}

function switchLang(lang) {
  localStorage.setItem('crucix-lang', lang);
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function toggleDebug() {
  const panel = document.getElementById('debugPanel');
  const btn = document.getElementById('debugToggle');
  panel.classList.toggle('open');
  btn.classList.toggle('active');
  if (panel.classList.contains('open')) {
    updateDebugInfo();
  }
}

async function updateDebugInfo() {
  const statusEl = document.getElementById('debugApiStatus');
  const rawEl = document.getElementById('debugRawData');
  const countEl = document.getElementById('debugCount');
  const fieldsEl = document.getElementById('debugFields');

  try {
    const res = await fetch('/api/rss/feeds');
    const data = await res.json();

    statusEl.innerHTML = 'API доступен | Статус: ' + res.status + ' | Время: ' + new Date().toLocaleTimeString();

    let items = [];
    if (data.feeds) items = data.feeds;
    else if (Array.isArray(data)) items = data;
    else if (data.data) items = data.data;
    else if (data.items) items = data.items;

    countEl.textContent = 'Всего записей: ' + items.length;

    if (items.length > 0) {
      const first = items[0];
      rawEl.textContent = JSON.stringify(first, null, 2);
      const keys = Object.keys(first);
      fieldsEl.textContent = 'Поля: ' + keys.join(', ');
    } else {
      rawEl.textContent = 'Данные отсутствуют (пустой массив)';
      fieldsEl.textContent = '—';
    }

    const badge = document.getElementById('debugBadge');
    if (items.length > 0) {
      badge.textContent = '✅ ' + items.length + ' записей';
      badge.style.color = '#4ade80';
    } else {
      badge.textContent = 'Нет данных';
      badge.style.color = '#fbbf24';
    }

  } catch (e) {
    statusEl.innerHTML = 'Ошибка: ' + e.message;
    rawEl.textContent = 'Ошибка загрузки: ' + e.message;
    countEl.textContent = '—';
    fieldsEl.textContent = '—';
  }
}

async function refreshFeed() {
  document.getElementById('loadingIndicator').style.display = 'block';
  document.getElementById('feedList').innerHTML = '';
  if (window.rssFeed) {
    await window.rssFeed.loadRealNews();
    window.rssFeed.applyFilter();
  }
  stopAutoScroll();
  startAutoScroll();
}

function closeDiagnostic() {
  document.getElementById('diagnosticPanel').classList.remove('open');
}

function copyDiagnostic() {
  const content = document.getElementById('diagnosticContent');
  const text = content.textContent || content.innerText || 'Нет данных';
  const report = '=== ДИАГНОСТИКА RSS СТРАНИЦЫ ===\n' + text;

  navigator.clipboard.writeText(report).then(() => {
    if (window.rssFeed) window.rssFeed.showNotification('Диагностика скопирована');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = report;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    if (window.rssFeed) window.rssFeed.showNotification('Диагностика скопирована');
  });
}

// ============================================================
// АВТОПРОКРУТКА
// ============================================================
let autoScrollInterval = null;

function startAutoScroll() {
  const container = document.getElementById('feedContainer');
  const toggle = document.getElementById('autoScrollToggle');
  if (!toggle || !toggle.checked) return;

  const speed = parseInt(document.getElementById('speedSlider').value);
  const delay = Math.max(200, 6000 - speed * 500);

  stopAutoScroll();
  autoScrollInterval = setInterval(() => {
    if (document.querySelector('.feed-item:hover')) return;
    container.scrollBy({ top: 1, behavior: 'smooth' });
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
      container.scrollTop = 0;
    }
  }, delay);
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('autoScrollToggle');
  const slider = document.getElementById('speedSlider');

  if (toggle) {
    toggle.addEventListener('change', function() {
      if (this.checked) startAutoScroll();
      else stopAutoScroll();
    });
  }

  if (slider) {
    slider.addEventListener('input', function() {
      document.getElementById('speedLabel').textContent = this.value;
      if (document.getElementById('autoScrollToggle').checked) {
        stopAutoScroll();
        startAutoScroll();
      }
    });
  }

  setTimeout(startAutoScroll, 2000);
});
