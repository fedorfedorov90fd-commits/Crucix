// ============================================================
// МОРСКОЙ МОНИТОРИНГ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let map = null;
let markers = [];
let zoneCircles = [];

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

async function updateVessels() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных о судах...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/maritime/update', { method: 'POST' });
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
    const resp = await fetch('/api/maritime/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderVessels(result.vessels);
      updateMap(result.vessels);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Maritime] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.totalVessels || 0;
  document.getElementById('stat-dark').textContent = stats.byStatus?.dark || 0;
  document.getElementById('stat-suspicious').textContent = stats.byStatus?.suspicious || 0;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '🚢 Загрузка данных...';
}

function renderVessels(vessels) {
  const container = document.getElementById('vessels-list');
  if (!vessels || vessels.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных о судах</div>';
    return;
  }

  let html = '';
  for (const v of vessels) {
    const statusClass = v.status === 'dark' ? 'status-dark' : 
                        v.status === 'suspicious' ? 'status-suspicious' : 'status-normal';
    html += `
      <div class="vessel-item">
        <span class="icon">${v.icon || '🚢'}</span>
        <span class="name">${v.name}</span>
        <span class="info">${v.typeLabel} · ${v.zoneName} · ${v.speed?.toFixed(1)} узлов</span>
        <span class="status-badge ${statusClass}">${v.statusLabel}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(vessels) {
  if (!map) {
    map = L.map('vessels-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];
  zoneCircles.forEach(c => map.removeLayer(c));
  zoneCircles = [];

  // Добавляем стратегические зоны
  fetch('/api/maritime/zones')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        for (const zone of data.zones) {
          const circle = L.circle([zone.lat, zone.lon], {
            radius: zone.radius * 50 * 1000,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '5, 5'
          }).addTo(map);
          zoneCircles.push(circle);
        }
      }
    });

  // Добавляем суда
  for (const v of vessels) {
    if (v.lat && v.lon) {
      const color = v.status === 'dark' ? '#ef4444' : 
                    v.status === 'suspicious' ? '#f97316' : v.color || '#6b7280';
      const size = v.status === 'dark' ? 14 : v.status === 'suspicious' ? 10 : 8;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;">${v.status === 'dark' ? '⚠️' : ''}</div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([v.lat, v.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${v.name}</strong><br>${v.typeLabel}<br>${v.statusLabel}<br>Скорость: ${v.speed?.toFixed(1)} узлов`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — МОРСКОЙ МОНИТОРИНГ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- СУДА ---\n`;
  document.querySelectorAll('.vessel-item').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const info = el.querySelector('.info')?.textContent || '—';
    const status = el.querySelector('.status-badge')?.textContent || '—';
    text += `${name} — ${info} — ${status}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/maritime-monitor\n`;
  
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
  document.getElementById('btn-update').addEventListener('click', updateVessels);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
