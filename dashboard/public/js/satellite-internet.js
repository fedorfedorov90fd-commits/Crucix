// ============================================================
// СПУТНИКОВЫЙ ИНТЕРНЕТ — КЛИЕНТСКАЯ ЛОГИКА
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
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/satellite-internet/update', { method: 'POST' });
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
    const resp = await fetch('/api/satellite-internet/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderConstellations(result.constellations);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Satellite Internet] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.totalSatellites?.toLocaleString() || 0;
  document.getElementById('stat-active').textContent = stats.operationalSatellites?.toLocaleString() || 0;
  document.getElementById('stat-constellations').textContent = stats.constellations || 0;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '🛰️ Загрузка данных...';
}

function renderConstellations(constellations) {
  const container = document.getElementById('constellations-grid');
  if (!constellations || constellations.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных о группировках</div>';
    return;
  }

  let html = '';
  for (const c of constellations) {
    const statusClass = c.status === 'operational' ? 'status-operational' : 
                        c.status === 'degraded' ? 'status-degraded' : 'status-critical';
    const statusLabel = c.status === 'operational' ? '🟢 Штатный' : 
                        c.status === 'degraded' ? '🟡 Снижена' : '🔴 Критический';
    
    html += `
      <div class="constellation-card" style="border-left-color: ${c.color || '#6b7280'}">
        <div class="name">${c.name}</div>
        <div class="provider">${c.provider} · ${c.type} · ${c.altitude} км</div>
        <div class="stats">
          <div class="stat-item-mini">
            <div class="label">Всего</div>
            <div class="value">${c.total}</div>
          </div>
          <div class="stat-item-mini">
            <div class="label">Активных</div>
            <div class="value" style="color:${c.color}">${c.active || 0}</div>
          </div>
          <div class="stat-item-mini">
            <div class="label">Рабочих</div>
            <div class="value" style="color:#22c55e">${c.operational || 0}</div>
          </div>
        </div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
        <div style="font-size:11px;color:#666;margin-top:4px;">${c.description}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — СПУТНИКОВЫЙ ИНТЕРНЕТ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- ГРУППИРОВКИ ---\n`;
  document.querySelectorAll('.constellation-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const provider = el.querySelector('.provider')?.textContent || '—';
    const stats = el.querySelectorAll('.stat-item-mini .value');
    const total = stats[0]?.textContent || '—';
    const active = stats[1]?.textContent || '—';
    const operational = stats[2]?.textContent || '—';
    const status = el.querySelector('.status-badge')?.textContent || '—';
    text += `${name} (${provider}): Всего ${total}, Активных ${active}, Рабочих ${operational} — ${status}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/satellite-internet\n`;
  
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
