// ============================================================
// РЫНОЧНЫЙ ПРОГНОЗ — КЛИЕНТСКАЯ ЛОГИКА
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

async function makePrediction() {
  const btn = document.getElementById('btn-predict');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Прогнозирование...';
  btn.disabled = true;
  label.textContent = '⏳ Анализ событий...';
  label.className = 'status-label running';

  try {
    document.getElementById('predictions-grid').innerHTML = '<div class="loading">⏳ Анализ...</div>';

    const resp = await fetch('/api/market/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await resp.json();

    if (data.success) {
      renderPredictions(data.result);
      renderSummary(data.result);
      renderPatterns(data.result);
      await loadHistory();
      showNotification('✅ Прогноз сформирован!');
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🔮 Сделать прогноз';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

function renderPredictions(result) {
  const container = document.getElementById('predictions-grid');
  const predictions = result.predictions || {};

  if (Object.keys(predictions).length === 0) {
    container.innerHTML = '<div class="empty">Нет прогнозов</div>';
    return;
  }

  let html = '';
  for (const [key, pred] of Object.entries(predictions)) {
    const sign = pred.direction === 'up' ? '+' : '';
    const cls = pred.direction === 'up' ? 'up' : 'down';
    const arrow = pred.direction === 'up' ? '📈' : '📉';

    html += `
      <div class="prediction-card" style="border-left-color: ${pred.color || '#6b7280'}">
        <div class="name">${pred.name}</div>
        <div class="change ${cls}">${sign}${pred.change.toFixed(1)}%</div>
        <div class="direction">${arrow}</div>
        <div class="confidence">Уверенность: ${pred.confidence}%</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '📊 Значительных рыночных сигналов не обнаружено.';
}

function renderPatterns(result) {
  const container = document.getElementById('patterns-content');
  const patterns = result.triggeredPatterns || [];

  if (patterns.length === 0) {
    container.innerHTML = '<div class="empty">Паттерны не обнаружены</div>';
    return;
  }

  let html = '';
  for (const p of patterns) {
    html += `
      <div class="pattern-item">
        <span class="name">${p.name}</span>
        <span class="conf">🔍 ${p.confidence}%</span>
        <span class="triggers">триггеры: ${p.triggers.join(', ').slice(0, 40)}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function loadHistory() {
  try {
    const resp = await fetch('/api/market/history?limit=5');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('history-content');
      if (data.history.length === 0) {
        container.innerHTML = '<div class="empty">История пуста</div>';
        return;
      }
      let html = '';
      for (const h of data.history) {
        const date = new Date(h.timestamp).toLocaleString();
        html += `
          <div class="history-item">
            <span class="date">${date}</span>
            <span class="summary">${h.summary || '—'}</span>
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) {
    console.error('[Market Predictor] Ошибка загрузки истории:', e);
  }
}

async function loadStats() {
  try {
    const resp = await fetch('/api/market/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalPredictions || 0;
      document.getElementById('stat-assets').textContent = data.stats.assets || 0;
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
      document.getElementById('panel-date').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
    }
  } catch (e) {
    console.error('[Market Predictor] Ошибка загрузки статистики:', e);
  }
}

// ============================================================
// КНОПКА КОПИРОВАНИЯ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — РЫНОЧНЫЙ ПРОГНОЗ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  text += `--- СТАТИСТИКА ---\n`;
  text += `Прогнозов: ${document.getElementById('stat-total').textContent}\n`;
  text += `Активов: ${document.getElementById('stat-assets').textContent}\n`;

  text += `\n--- ПРОГНОЗЫ ---\n`;
  document.querySelectorAll('.prediction-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const change = el.querySelector('.change')?.textContent || '—';
    const conf = el.querySelector('.confidence')?.textContent || '—';
    text += `${name}: ${change} (${conf})\n`;
  });

  text += `\n--- РЕЗЮМЕ ---\n`;
  const summary = document.getElementById('summary-content').textContent || '—';
  text += summary + '\n';

  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/market-predictor\n`;

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
  document.getElementById('btn-predict').addEventListener('click', makePrediction);
  document.getElementById('btn-refresh').addEventListener('click', function() { loadStats(); loadHistory(); });

  loadStats();
  loadHistory();
});
