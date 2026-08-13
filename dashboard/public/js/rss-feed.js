// RSS Лента новостей — Crucix с AI-оценками

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
        this.currentRegion = btn.dataset.region;
        this.applyFilter();
      });
    });
  }
  
  async loadRealNews() {
    try {
      const response = await fetch('/api/news/latest?limit=50');
      const data = await response.json();
      
      if (data.success && data.news && data.news.length > 0) {
        this.items = data.news.map(item => ({
          id: item.id || 'news-' + Math.random(),
          title: item.title || 'Без заголовка',
          source: item.source || item.category || 'Источник',
          region: this.detectRegion(item),
          regionName: this.getRegionEmoji(this.detectRegion(item)),
          date: item.collectedAt || item.pubDate || new Date().toISOString(),
          url: item.link || '#',
          summary: item.description || item.summary || 'Новость из RSS-ленты',
          ai_score: null,
          ai_importance: 'unknown'
        }));
        
        // Оцениваем через AI (первые 20)
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
    // Оцениваем только новости без оценки
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
        // Обновляем оценки
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
      'Аналитика': 'think-tanks',
      'Прогнозы': 'forecasts'
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
      'Новый закон о кибербезопасности вступает в силу в ЕС'
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
        summary: 'Демонстрационная новость',
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
    const items = this.filteredItems.slice(0, this.maxItems);
    
    if (items.length === 0) {
      this.track.innerHTML = '<div class="feed-empty">Нет новостей</div>';
      return;
    }
    
    let html = '';
    for (const item of items) {
      const time = new Date(item.date);
      const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const title = this.escapeHtml(item.title);
      const source = this.escapeHtml(item.source);
      const regionName = item.regionName || '📰';
      
      // Определяем класс для оценки
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
        <div class="feed-item ${scoreClass}" onclick="window.rssFeed?.showArticleModal('${title.replace(/'/g, "\\'")}', '${source.replace(/'/g, "\\'")}', '${(item.summary || '').replace(/'/g, "\\'")}')">
          <span class="feed-icon">${regionName}</span>
          <span class="feed-title">${title}</span>
          <span class="feed-source">${source}</span>
          <span class="feed-time">${timeStr}</span>
          <span class="feed-score">${scoreText}</span>
        </div>
      `;
    }
    
    this.track.innerHTML = html;
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
      'think-tanks': '🧠', 'forecasts': '📊'
    };
    return map[region] || '📰';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.rssFeed = new RSSFeed();
});
