// ============================================================
// СЕМАНТИЧЕСКИЙ АНАЛИЗ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

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

async function analyzeBasket() {
  const btn = document.getElementById('btn-analyze-basket');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Анализ...';
  btn.disabled = true;
  label.textContent = '⏳ Анализ текстов...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/semantic/analyze-basket', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 20 })
    });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Анализ завершён!');
      renderAnalysis(data.result);
      await loadStats();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '📊 Анализировать корзину';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

function renderAnalysis(result) {
  if (!result || result.error) {
    document.getElementById('sentiment-content').innerHTML = `<div class="empty">${result?.error || 'Нет данных'}</div>`;
    return;
  }

  // Тональность
  renderSentiment(result.summary);
  
  // Сущности
  renderEntities(result.summary);
  
  // Топ-темы
  renderTopics(result.summary);
  
  // Детальные результаты
  renderResults(result.results);
}

function renderSentiment(summary) {
  const container = document.getElementById('sentiment-content');
  if (!summary) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  const sentiments = summary.sentiments || {};
  const dominant = summary.dominantIcon || '😐';
  const dominantLabel = summary.dominantLabel || 'Нейтральная';

  container.innerHTML = `
    <div class="sentiment-item">
      <div class="icon">${dominant}</div>
      <div class="label">Преобладает</div>
      <div class="value">${dominantLabel}</div>
    </div>
    <div class="sentiment-item">
      <div class="icon">😊</div>
      <div class="label">Позитивные</div>
      <div class="value" style="color:#22c55e">${summary.positivePercent || 0}%</div>
    </div>
    <div class="sentiment-item">
      <div class="icon">😠</div>
      <div class="label">Негативные</div>
      <div class="value" style="color:#ef4444">${summary.negativePercent || 0}%</div>
    </div>
    <div class="sentiment-item">
      <div class="icon">😐</div>
      <div class="label">Нейтральные</div>
      <div class="value" style="color:#6b7280">${summary.neutralPercent || 0}%</div>
    </div>
  `;
}

function renderEntities(summary) {
  const container = document.getElementById('entities-content');
  const entities = summary?.topEntities || [];
  if (entities.length === 0) {
    container.innerHTML = '<div class="empty">Сущности не найдены</div>';
    return;
  }
  container.innerHTML = entities.map(e => `<span class="entity-tag">🏷️ ${e}</span>`).join('');
}

function renderTopics(summary) {
  const container = document.getElementById('topics-content');
  const topics = summary?.topTopics || [];
  if (topics.length === 0) {
    container.innerHTML = '<div class="empty">Темы не найдены</div>';
    return;
  }
  container.innerHTML = topics.map(t => `<span class="topic-tag">📌 ${t}</span>`).join('');
}

function renderResults(results) {
  const container = document.getElementById('results-content');
  if (!results || results.length === 0) {
    container.innerHTML = '<div class="empty">Нет результатов</div>';
    return;
  }

  const sentimentIcons = { positive: '😊', negative: '😠', neutral: '😐', mixed: '🤔' };
  const sentimentColors = { positive: '#22c55e', negative: '#ef4444', neutral: '#6b7280', mixed: '#f59e0b' };

  let html = '';
  for (const r of results.slice(0, 20)) {
    const sentiment = r.analysis?.sentiment || 'neutral';
    const icon = sentimentIcons[sentiment] || '😐';
    const color = sentimentColors[sentiment] || '#6b7280';
    const topics = (r.analysis?.topics || []).join(', ');
    
    html += `
      <div class="result-item" style="border-left-color: ${color}">
        <div class="text">${r.text || '—'}</div>
        <div class="sentiment">${icon} ${sentiment} (уверенность: ${Math.round((r.analysis?.confidence || 0) * 100)}%)</div>
        <div class="topics">📌 ${topics || 'Темы не определены'}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function loadStats() {
  try {
    const resp = await fetch('/api/semantic/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalAnalyzed || 0;
      document.getElementById('stat-sessions').textContent = data.stats.totalSessions || 0;
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
    }
  } catch (e) {
    console.error('[Semantic] Ошибка загрузки статистики:', e);
  }
}

async function loadLatest() {
  try {
    const resp = await fetch('/api/semantic/latest');
    const data = await resp.json();
    if (data.success && data.result) {
      renderAnalysis(data.result);
    }
  } catch (e) {
    console.error('[Semantic] Ошибка загрузки последнего анализа:', e);
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — СЕМАНТИЧЕСКИЙ АНАЛИЗ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  // Собираем данные с панели тональности
  const sentimentItems = document.querySelectorAll('.sentiment-item');
  for (const item of sentimentItems) {
    const label = item.querySelector('.label')?.textContent || '—';
    const value = item.querySelector('.value')?.textContent || '—';
    text += `${label}: ${value}\n`;
  }
  
  text += '\n--- СУЩНОСТИ ---\n';
  const entities = document.querySelectorAll('.entity-tag');
  for (const e of entities) {
    text += `${e.textContent}\n`;
  }
  
  text += '\n--- ТЕМЫ ---\n';
  const topics = document.querySelectorAll('.topic-tag');
  for (const t of topics) {
    text += `${t.textContent}\n`;
  }
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/semantic-analysis\n`;
  
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
  document.getElementById('btn-analyze-basket').addEventListener('click', analyzeBasket);
  document.getElementById('btn-refresh').addEventListener('click', function() { loadStats(); loadLatest(); });
  
  loadStats();
  loadLatest();
});
