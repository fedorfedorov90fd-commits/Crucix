// ============================================================
// ДЕТЕКТОР АНОМАЛИЙ — КЛИЕНТСКАЯ ЛОГИКА
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

async function updateData() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Сканирование...';
  btn.disabled = true;
  label.textContent = '⏳ Поиск аномалий...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/anomaly-detector/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Сканирование завершено!');
      await loadData();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🔍 Сканировать аномалии';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

async function loadData() {
  await loadStats();
  await loadAnomalies();
}

async function loadStats() {
  try {
    const resp = await fetch('/api/anomaly-detector/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalAnomalies || 0;
      document.getElementById('stat-active').textContent = data.stats.activeAnomalies || 0;
      document.getElementById('stat-critical').textContent = data.stats.bySeverity?.critical || 0;
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
    }
  } catch (e) {
    console.error('[Anomaly] Ошибка загрузки статистики:', e);
  }
}

async function loadAnomalies() {
  try {
    const resp = await fetch('/api/anomaly-detector/anomalies');
    const data = await resp.json();
    if (data.success) {
      renderAnomalies(data.anomalies);
    }
  } catch (e) {
    console.error('[Anomaly] Ошибка загрузки аномалий:', e);
  }
}

function renderAnomalies(anomalies) {
  const container = document.getElementById('anomalies-list');
  if (!anomalies || anomalies.length === 0) {
    container.innerHTML = '<div class="empty">✅ Аномалий не обнаружено</div>';
    return;
  }

  let html = '';
  for (const a of anomalies) {
    const severityClass = `severity-${a.severity}`;
    const severityLabel = a.severity.toUpperCase();
    const typeInfo = a.typeInfo || { icon: '⚠️', name: 'Необычное' };
    const date = new Date(a.timestamp).toLocaleString();
    
    html += `
      <div class="anomaly-item" style="border-left-color: ${a.color || '#6b7280'}">
        <span class="icon">${a.icon || typeInfo.icon || '⚠️'}</span>
        <div class="info">
          <div class="source">${a.sourceName}</div>
          <div class="desc">${a.description}</div>
          <div class="meta">${typeInfo.name} · ${date} · Z-score: ${a.zScore?.toFixed(2) || '—'}</div>
        </div>
        <span class="severity ${severityClass}">${severityLabel}</span>
        <button class="resolve-btn" onclick="resolveAnomaly('${a.id}')">✓</button>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function resolveAnomaly(id) {
  try {
    const resp = await fetch(`/api/anomaly-detector/anomalies/${id}/resolve`, { method: 'PUT' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Аномалия помечена как решённая');
      await loadData();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ДЕТЕКТОР АНОМАЛИЙ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- АНОМАЛИИ ---\n`;
  document.querySelectorAll('.anomaly-item').forEach(el => {
    const source = el.querySelector('.source')?.textContent || '—';
    const desc = el.querySelector('.desc')?.textContent || '—';
    const severity = el.querySelector('.severity')?.textContent || '—';
    text += `${source} — ${desc} — ${severity}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/anomaly-detector\n`;
  
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
