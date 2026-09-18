// ============================================================
// ПРОГНОЗИРОВАНИЕ КОНФЛИКТОВ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let map = null;
let markers = [];

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

async function updatePrediction() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Прогнозирование...';
  btn.disabled = true;
  label.textContent = '⏳ AI-анализ данных...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/conflict/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Прогноз сформирован!');
      await loadData();
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

async function loadData() {
  await loadLatest();
  await loadHistory();
}

async function loadLatest() {
  try {
    const resp = await fetch('/api/conflict/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderRegions(result.predictions);
      updateMap(result.predictions);
      updateStats(result.predictions);
    }
  } catch (e) {
    console.error('[Conflict Predictor] Ошибка загрузки:', e);
  }
}

function updateStats(predictions) {
  const critical = predictions.filter(p => p.level === 'critical').length;
  const high = predictions.filter(p => p.level === 'high').length;
  document.getElementById('stat-critical').textContent = critical;
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '🟢 Все регионы стабильны. Конфликтов не прогнозируется.';
}

function renderRegions(predictions) {
  const container = document.getElementById('regions-grid');
  if (!predictions || predictions.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = '';
  for (const p of predictions) {
    const riskClass = p.risk >= 75 ? 'high' : p.risk >= 50 ? 'medium' : 'low';
    html += `
      <div class="region-card ${p.level}">
        <div class="name">${p.region}</div>
        <div class="level">${p.label}</div>
        <div class="risk ${riskClass}">${p.risk}%</div>
        <div class="prediction">📅 7д: ${p.predictions.day7}% | 14д: ${p.predictions.day14}% | 30д: ${p.predictions.day30}%</div>
        <div class="factors">📊 ACLED: ${p.factors.acled_events} событий | Индекс: ${p.factors.index_value}</div>
        <div class="rec">${p.recommendation}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(predictions) {
  if (!map) {
    map = L.map('risk-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const p of predictions) {
    if (p.coordinates) {
      const color = p.color || '#6b7280';
      const size = 8 + (p.risk / 10) * 2;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([p.coordinates.lat, p.coordinates.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${p.region}</strong><br>Риск: ${p.risk}%<br>${p.label}`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

async function loadHistory() {
  try {
    const resp = await fetch('/api/conflict/history?limit=5');
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
    console.error('[Conflict Predictor] Ошибка загрузки истории:', e);
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ПРОГНОЗИРОВАНИЕ КОНФЛИКТОВ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- РЕГИОНЫ ---\n`;
  document.querySelectorAll('.region-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const level = el.querySelector('.level')?.textContent || '—';
    const risk = el.querySelector('.risk')?.textContent || '—';
    const rec = el.querySelector('.rec')?.textContent || '';
    text += `${name}: ${risk} ${level} — ${rec}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/conflict-predictor\n`;
  
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
  document.getElementById('btn-update').addEventListener('click', updatePrediction);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
