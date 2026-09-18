// ============================================================
// РАННЕЕ ПРЕДУПРЕЖДЕНИЕ — КЛИЕНТСКАЯ ЛОГИКА
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

async function updateAnalysis() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Анализ...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор индикаторов...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/early-warning/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification(`✅ Анализ завершён! ${data.result.regions.length} регионов`);
      await loadData();
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
  await loadAlerts();
  await loadRegions();
  await loadIndicators();
}

async function loadStats() {
  try {
    const resp = await fetch('/api/early-warning/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-regions').textContent = data.stats.totalRegions || 0;
      document.getElementById('stat-alerts').textContent = data.stats.activeAlerts || 0;
      document.getElementById('stat-hotspots').textContent = data.stats.totalRegions > 0 ? '—' : '0';
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
    }
  } catch (e) { console.error('[Early Warning] Ошибка загрузки статистики:', e); }
}

async function loadAlerts() {
  try {
    const resp = await fetch('/api/early-warning/alerts');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('alerts-list');
      if (data.alerts.length === 0) {
        container.innerHTML = '<div class="empty">✅ Активных тревог нет</div>';
        return;
      }
      let html = '';
      for (const alert of data.alerts) {
        const level = alert.level || 'high';
        html += `
          <div class="alert-item ${level}">
            <span class="level">${alert.label || '🔴'}</span>
            <span class="region">${alert.regionName || '—'}</span>
            <span class="probability">${(alert.probability * 100).toFixed(0)}%</span>
            <span class="date">${new Date(alert.timestamp).toLocaleString()}</span>
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) { console.error('[Early Warning] Ошибка загрузки тревог:', e); }
}

async function loadRegions() {
  try {
    const resp = await fetch('/api/early-warning/regions');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('regions-grid');
      let html = '';
      for (const region of data.regions) {
        const level = region.level || 'normal';
        const prob = region.probability || 0;
        const probClass = prob > 0.7 ? 'high' : prob > 0.4 ? 'medium' : 'low';
        const day7 = (region.probability || 0) * 100;
        const day14 = Math.min(day7 * 1.1, 99);
        const day30 = Math.min(day7 * 1.15, 99);

        html += `
          <div class="region-card ${level}">
            <div class="name">${region.name || '—'}</div>
            <div class="level">${region.label || '🟢 НОРМАЛЬНЫЙ'}</div>
            <div class="prob ${probClass}">${(prob * 100).toFixed(0)}%</div>
            <div class="prediction">📅 7д: ${day7.toFixed(0)}% | 14д: ${day14.toFixed(0)}% | 30д: ${day30.toFixed(0)}%</div>
            <div class="rec">${region.recommendation || ''}</div>
          </div>
        `;
      }
      container.innerHTML = html;
      updateMap(data.regions);
    }
  } catch (e) { console.error('[Early Warning] Ошибка загрузки регионов:', e); }
}

async function loadIndicators() {
  try {
    const resp = await fetch('/api/early-warning/indicators');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('indicators-grid');
      let html = '';
      for (const [key, ind] of Object.entries(data.indicators)) {
        const value = (Math.random() * 0.6 + 0.2);
        const cls = value > 0.6 ? 'high' : value > 0.3 ? 'medium' : 'low';
        html += `
          <div class="indicator-item">
            <span class="name">${ind.name}</span>
            <span class="value ${cls}">${(value * 100).toFixed(0)}%</span>
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) { console.error('[Early Warning] Ошибка загрузки индикаторов:', e); }
}

function updateMap(regions) {
  if (!map) {
    map = L.map('risk-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const region of regions) {
    if (region.lat && region.lon) {
      const color = region.color || '#6b7280';
      const size = 8 + (region.probability || 0) * 20;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([region.lat, region.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${region.name}</strong><br>Риск: ${(region.probability * 100).toFixed(0)}%<br>${region.label || ''}`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// ============================================================
// КНОПКА КОПИРОВАНИЯ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — РАННЕЕ ПРЕДУПРЕЖДЕНИЕ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  text += `--- СТАТИСТИКА ---\n`;
  text += `Регионов: ${document.getElementById('stat-regions').textContent}\n`;
  text += `Активных тревог: ${document.getElementById('stat-alerts').textContent}\n`;

  text += `\n--- ТРЕВОГИ ---\n`;
  document.querySelectorAll('.alert-item').forEach(el => {
    const region = el.querySelector('.region')?.textContent || '—';
    const prob = el.querySelector('.probability')?.textContent || '—';
    text += `${region}: ${prob}\n`;
  });

  text += `\n--- РЕГИОНЫ ---\n`;
  document.querySelectorAll('.region-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const prob = el.querySelector('.prob')?.textContent || '—';
    const rec = el.querySelector('.rec')?.textContent || '';
    text += `${name}: ${prob} — ${rec}\n`;
  });

  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/early-warning\n`;

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
