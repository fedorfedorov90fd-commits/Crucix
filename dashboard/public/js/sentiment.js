// ============================================================
// КВАНТОВЫЙ АНАЛИЗАТОР ТОНАЛЬНОСТИ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

function updateTopbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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

async function updateAnalysis() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Анализ...';
  btn.disabled = true;
  label.textContent = '⏳ Анализ тональности...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/sentiment/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      loadData();
      showNotification('✅ Анализ обновлён!');
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🔄 Обновить анализ';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

async function loadData() {
  await loadStats();
  await loadRegions();
  await loadNews();
}

async function loadStats() {
  try {
    const resp = await fetch('/api/sentiment/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.total || 0;
      document.getElementById('stat-positive').textContent = data.stats.positive || 0;
      document.getElementById('stat-neutral').textContent = data.stats.neutral || 0;
      document.getElementById('stat-negative').textContent = data.stats.negative || 0;
      document.getElementById('stat-news').textContent = data.stats.newsCount || 0;
    }
  } catch (e) { console.error('[Sentiment] Ошибка загрузки статистики:', e); }
}

async function loadRegions() {
  try {
    const resp = await fetch('/api/sentiment/regions');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('regions-grid');
      let html = '';
      for (const r of data.regions) {
        const sentiment = (r.sentiment * 100).toFixed(0);
        const color = r.sentiment > 0.3 ? '#22c55e' :
                      r.sentiment > 0.1 ? '#84cc16' :
                      r.sentiment > -0.1 ? '#eab308' :
                      r.sentiment > -0.3 ? '#f97316' : '#ef4444';
        const trendIcon = r.trend === 'rising' ? '📈' :
                          r.trend === 'falling' ? '📉' : '➡️';
        const trendClass = r.trend === 'rising' ? 'trend-up' :
                           r.trend === 'falling' ? 'trend-down' : 'trend-stable';
        const label = r.sentiment > 0.3 ? '🟢 Позитивный' :
                      r.sentiment > 0.1 ? '🟢 Нейтрально-позитивный' :
                      r.sentiment > -0.1 ? '🟡 Нейтральный' :
                      r.sentiment > -0.3 ? '🟠 Нейтрально-негативный' : '🔴 Негативный';

        html += `
          <div class="region-card" style="border-left-color: ${color}">
            <div class="header">
              <span class="name">${r.name}</span>
              <span class="sentiment" style="color: ${color}">${sentiment}%</span>
            </div>
            <div class="trend ${trendClass}">${trendIcon} ${r.trend}</div>
            <div class="label">${label}</div>
            <div class="news-count">Новостей: ${r.newsCount || 0}</div>
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) { console.error('[Sentiment] Ошибка загрузки регионов:', e); }
}

async function loadNews() {
  try {
    const resp = await fetch('/api/sentiment/news?limit=20');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('news-list');
      if (data.news.length === 0) {
        container.innerHTML = '<div class="empty">Нет новостей</div>';
        return;
      }
      let html = '';
      for (const n of data.news) {
        const sentiment = (n.sentiment * 100).toFixed(0);
        const color = n.sentiment > 0.3 ? '#22c55e' :
                      n.sentiment > 0.1 ? '#84cc16' :
                      n.sentiment > -0.1 ? '#eab308' :
                      n.sentiment > -0.3 ? '#f97316' : '#ef4444';
        html += `
          <div class="news-item" style="border-left-color: ${color}">
            <span class="sentiment-badge" style="color: ${color}">${sentiment}%</span>
            <span class="title">${n.title || '—'}</span>
            <span class="region">${n.region || '—'}</span>
            <span class="source">${n.source || '—'}</span>
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) { console.error('[Sentiment] Ошибка загрузки новостей:', e); }
}

// ============================================================
// КНОПКА КОПИРОВАНИЯ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — КВАНТОВЫЙ АНАЛИЗАТОР ТОНАЛЬНОСТИ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  text += `--- СТАТИСТИКА ---\n`;
  text += `Регионов: ${document.getElementById('stat-total').textContent}\n`;
  text += `Позитивные: ${document.getElementById('stat-positive').textContent}\n`;
  text += `Нейтральные: ${document.getElementById('stat-neutral').textContent}\n`;
  text += `Негативные: ${document.getElementById('stat-negative').textContent}\n`;

  text += `\n--- РЕГИОНЫ ---\n`;
  document.querySelectorAll('.region-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const sentiment = el.querySelector('.sentiment')?.textContent || '—';
    const label = el.querySelector('.label')?.textContent || '—';
    text += `${name}: ${sentiment} (${label})\n`;
  });

  text += `\n--- НОВОСТИ ---\n`;
  document.querySelectorAll('.news-item').forEach(el => {
    const title = el.querySelector('.title')?.textContent || '—';
    const badge = el.querySelector('.sentiment-badge')?.textContent || '—';
    text += `${badge}  ${title}\n`;
  });

  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/sentiment\n`;

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

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-update').addEventListener('click', updateAnalysis);
  document.getElementById('btn-refresh').addEventListener('click', loadData);

  loadData();
});
