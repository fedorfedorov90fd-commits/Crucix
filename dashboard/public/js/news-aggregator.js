// ============================================================
// НОВОСТНОЙ АГРЕГАТОР — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let allNews = [];
let sourcesData = {};

function updateTopbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  document.getElementById('topbar-date').textContent = `${dateStr} ${timeStr}`;
}
updateTopbar();
setInterval(updateTopbar, 60000);

function showNotification(msg) {
  document.querySelectorAll('.notification').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

let gridVisible = false;
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); toggleGrid(); }
});
document.getElementById('grid-toggle').addEventListener('click', toggleGrid);

function toggleGrid() {
  gridVisible = !gridVisible;
  document.getElementById('coordinate-grid').classList.toggle('visible', gridVisible);
  document.getElementById('grid-coords').classList.toggle('visible', gridVisible);
  document.getElementById('grid-toggle').classList.toggle('active', gridVisible);
  if (gridVisible) {
    showNotification('⊞ Сетка включена');
    document.addEventListener('mousemove', updateCoords);
  } else {
    showNotification('⊞ Сетка выключена');
    document.removeEventListener('mousemove', updateCoords);
  }
}
function updateCoords(e) {
  document.getElementById('grid-coords').textContent = `X: ${e.clientX}  Y: ${e.clientY}`;
}

async function updateData() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Сбор...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор новостей...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/news-aggregator/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Новости собраны!');
      await loadData();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🔄 Собрать новости';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

async function loadData() {
  await loadSources();
  await loadNews();
  await loadStats();
}

async function loadSources() {
  try {
    const resp = await fetch('/api/news-aggregator/sources');
    const data = await resp.json();
    if (data.success) {
      sourcesData = data.sources;
      renderSources(data.sources);
      populateSourceFilter(data.sources);
    }
  } catch (e) {
    console.error('[News] Ошибка загрузки источников:', e);
  }
}

function renderSources(sources) {
  const container = document.getElementById('sources-list');
  let html = '';
  for (const [id, source] of Object.entries(sources)) {
    const statusClass = source.enabled ? 'active' : 'inactive';
    const statusText = source.enabled ? '🟢 Вкл' : '⛔ Выкл';
    html += `
      <div class="source-item">
        <span>${source.icon || '📰'}</span>
        <span>${source.name}</span>
        <span class="status ${statusClass}">${statusText}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function populateSourceFilter(sources) {
  const select = document.getElementById('filter-source');
  select.innerHTML = '<option value="all">Все источники</option>';
  for (const [id, source] of Object.entries(sources)) {
    if (source.enabled) {
      select.innerHTML += `<option value="${id}">${source.name}</option>`;
    }
  }
}

async function loadNews() {
  try {
    const source = document.getElementById('filter-source').value;
    const category = document.getElementById('filter-category').value;
    const importance = document.getElementById('filter-importance').value;
    
    let url = '/api/news-aggregator/news?limit=100';
    if (source !== 'all') url += `&source=${source}`;
    if (category !== 'all') url += `&category=${category}`;
    if (importance !== 'all') url += `&importance=${importance}`;
    
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.success) {
      allNews = data.news;
      renderNews(data.news);
    }
  } catch (e) {
    console.error('[News] Ошибка загрузки новостей:', e);
  }
}

function renderNews(news) {
  const container = document.getElementById('news-list');
  if (!news || news.length === 0) {
    container.innerHTML = '<div class="empty">Новостей не найдено</div>';
    return;
  }

  let html = '';
  for (const item of news) {
    const importanceClass = `importance-${item.importance}`;
    const importanceLabel = item.importance === 'high' ? '🔴' : item.importance === 'medium' ? '🟡' : '🟢';
    const date = new Date(item.timestamp).toLocaleString();
    html += `
      <div class="news-item" style="border-left-color: ${item.sourceColor || '#6b7280'}">
        <span class="source">${item.sourceIcon || '📰'} ${item.sourceName}</span>
        <span class="title">${item.title}</span>
        <span class="category">${item.category} · ${item.region}</span>
        <span class="importance ${importanceClass}">${importanceLabel}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function loadStats() {
  try {
    const resp = await fetch('/api/news-aggregator/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalNews || 0;
      document.getElementById('stat-sources').textContent = data.stats.totalSources || 0;
      document.getElementById('stat-active').textContent = data.stats.activeSources || 0;
      document.getElementById('stat-high').textContent = data.stats.byImportance?.high || 0;
      
      if (data.result) {
        document.getElementById('summary-content').innerHTML = data.result.summary || '📰 Ожидание данных...';
      }
    }
  } catch (e) {
    console.error('[News] Ошибка загрузки статистики:', e);
  }
}

// Фильтры
document.getElementById('filter-source').addEventListener('change', loadNews);
document.getElementById('filter-category').addEventListener('change', loadNews);
document.getElementById('filter-importance').addEventListener('change', loadNews);

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — НОВОСТНОЙ АГРЕГАТОР ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- НОВОСТИ ---\n`;
  document.querySelectorAll('.news-item').forEach(el => {
    const source = el.querySelector('.source')?.textContent || '—';
    const title = el.querySelector('.title')?.textContent || '—';
    const category = el.querySelector('.category')?.textContent || '—';
    const importance = el.querySelector('.importance')?.textContent || '—';
    text += `${source} — ${title} (${category}) — ${importance}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/news-aggregator\n`;
  
  navigator.clipboard.writeText(text).then(() => {
    showNotification('✅ Данные скопированы');
  }).catch(() => {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    showNotification('✅ Данные скопированы');
  });
});

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-update').addEventListener('click', updateData);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
