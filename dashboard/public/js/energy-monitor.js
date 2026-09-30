// ============================================================
// МОНИТОРИНГ ЭНЕРГЕТИКИ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let chart = null;

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
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных о ценах...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/energy/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Данные обновлены!');
      await loadData();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🔄 Обновить данные';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

async function loadData() {
  await loadLatest();
}

async function loadLatest() {
  try {
    const resp = await fetch('/api/energy/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderPrices(result.prices);
      renderPredictions(result.predictions);
      renderChart(result.history);
      updateStats(result);
    }
  } catch (e) {
    console.error('[Energy] Ошибка загрузки:', e);
  }
}

function renderPrices(prices) {
  const container = document.getElementById('prices-grid');
  if (!prices || Object.keys(prices).length === 0) {
    container.innerHTML = '<div class="empty">Нет данных о ценах</div>';
    return;
  }

  const typeNames = {
    wti: 'WTI Crude',
    brent: 'Brent Crude',
    natural_gas: 'Природный газ',
    coal: 'Уголь',
    gasoline: 'Бензин',
    heating_oil: 'Мазут'
  };

  let html = '';
  for (const [key, price] of Object.entries(prices)) {
    const changeClass = price.change > 0 ? 'up' : 'down';
    const changeIcon = price.change > 0 ? '📈' : price.change < 0 ? '📉' : '➡️';
    html += `
      <div class="price-card">
        <div class="name">${typeNames[key] || key}</div>
        <div class="price">$${price.current}</div>
        <div class="change ${changeClass}">${changeIcon} ${price.change > 0 ? '+' : ''}${price.change}%</div>
        <div class="info">High: $${price.high} · Low: $${price.low}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderPredictions(predictions) {
  const container = document.getElementById('predictions-content');
  if (!predictions || Object.keys(predictions).length === 0) {
    container.innerHTML = '<div class="empty">Нет прогнозов</div>';
    return;
  }

  const typeNames = {
    wti: 'WTI Crude',
    brent: 'Brent Crude',
    natural_gas: 'Природный газ',
    coal: 'Уголь',
    gasoline: 'Бензин',
    heating_oil: 'Мазут'
  };

  let html = '';
  for (const [key, pred] of Object.entries(predictions)) {
    const trendIcon = pred.trend > 0 ? '📈' : pred.trend < 0 ? '📉' : '➡️';
    html += `
      <div class="pred-item">
        <span class="name">${typeNames[key] || key}</span>
        <span class="values">Текущая: $${pred.current} → 7д: $${pred.day7} → 30д: $${pred.day30}</span>
        <span class="trend">${trendIcon} ${pred.confidence}%</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderChart(history) {
  if (!history || history.length === 0) return;

  const ctx = document.getElementById('price-chart').getContext('2d');
  const labels = history.map(h => h.date);
  
  const datasets = [
    { label: 'WTI Crude', data: history.map(h => h.wti), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', tension: 0.1 },
    { label: 'Brent Crude', data: history.map(h => h.brent), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.1 },
    { label: 'Природный газ', data: history.map(h => h.natural_gas), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.1 },
    { label: 'Уголь', data: history.map(h => h.coal), borderColor: '#6b7280', backgroundColor: 'rgba(107,114,128,0.1)', tension: 0.1 }
  ];

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#c8d0d8', font: { size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#666', maxTicksLimit: 15 },
          grid: { color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          ticks: { color: '#666' },
          grid: { color: 'rgba(255,255,255,0.03)' }
        }
      }
    }
  });
}

function updateStats(result) {
  document.getElementById('stat-types').textContent = Object.keys(result.prices || {}).length;
  document.getElementById('stat-last').textContent = new Date(result.timestamp).toLocaleString();
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — МОНИТОРИНГ ЭНЕРГЕТИКИ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- ЦЕНЫ ---\n`;
  document.querySelectorAll('.price-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const price = el.querySelector('.price')?.textContent || '—';
    const change = el.querySelector('.change')?.textContent || '—';
    text += `${name}: ${price} (${change})\n`;
  });
  
  text += `\n--- ПРОГНОЗЫ ---\n`;
  document.querySelectorAll('.pred-item').forEach(el => {
    const textContent = el.textContent?.trim() || '—';
    text += `${textContent}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/energy-monitor\n`;
  
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
