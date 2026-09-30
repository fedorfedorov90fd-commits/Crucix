// ============================================================
// ТЁМНЫЕ СУДА — КЛИЕНТСКАЯ ЛОГИКА
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

async function updateShips() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Сканирование...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных о судах...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/dark-ships/update', { method: 'POST' });
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
    btn.textContent = '🔄 Сканировать суда';
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
    const resp = await fetch('/api/dark-ships/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderShips(result.ships);
      updateMap(result.ships);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Dark Ships] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-dark').textContent = stats.byStatus?.dark || 0;
  document.getElementById('stat-suspicious').textContent = stats.byStatus?.suspicious || 0;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '🟢 Подозрительных судов не обнаружено.';
}

function renderShips(ships) {
  const container = document.getElementById('ships-list');
  if (!ships || ships.length === 0) {
    container.innerHTML = '<div class="empty">Судов не обнаружено</div>';
    return;
  }

  let html = '';
  for (const s of ships) {
    const statusClass = s.status === 'dark' ? 'status-dark' : s.status === 'suspicious' ? 'status-suspicious' : 'status-normal';
    html += `
      <div class="ship-item" style="border-left-color: ${s.color || '#6b7280'}">
        <span class="icon">${s.icon || '🚢'}</span>
        <div class="info">
          <div class="name">${s.name}</div>
          <div class="desc">${s.typeLabel} · ${s.zoneName || 'Открытое море'}</div>
          <div class="meta">Скорость: ${s.speed} узлов · Курс: ${s.course}° · ${new Date(s.timestamp).toLocaleString()}</div>
        </div>
        <span class="status-label ${statusClass}">${s.statusLabel}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(ships) {
  if (!map) {
    map = L.map('ships-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  // Очищаем старые маркеры и зоны
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  zoneCircles.forEach(c => map.removeLayer(c));
  zoneCircles = [];

  // Добавляем стратегические зоны
  fetch('/api/dark-ships/zones')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        for (const zone of data.zones) {
          const circle = L.circle([zone.lat, zone.lon], {
            radius: zone.radius * 50 * 1000, // км в метры
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '5, 5'
          }).addTo(map);
          zoneCircles.push(circle);
          
          L.marker([zone.lat, zone.lon], {
            icon: L.divIcon({
              className: 'zone-label',
              html: `<div style="color:#3b82f6;font-size:10px;font-weight:600;text-shadow:0 0 10px rgba(0,0,0,0.8);">${zone.name}</div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            })
          }).addTo(map);
        }
      }
    });

  // Добавляем суда
  for (const s of ships) {
    if (s.lat && s.lon) {
      const size = s.status === 'dark' ? 14 : s.status === 'suspicious' ? 10 : 8;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${s.color || '#6b7280'};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${s.color || '#6b7280'}40;cursor:pointer;">${s.status === 'dark' ? '⚠️' : ''}</div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([s.lat, s.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${s.name}</strong><br>${s.typeLabel}<br>${s.statusLabel}<br>Скорость: ${s.speed} узлов`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ТЁМНЫЕ СУДА ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- СУДА ---\n`;
  document.querySelectorAll('.ship-item').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const status = el.querySelector('.status-label')?.textContent || '—';
    const desc = el.querySelector('.desc')?.textContent || '—';
    text += `${name} — ${status} (${desc})\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/dark-ships\n`;
  
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
  document.getElementById('btn-update').addEventListener('click', updateShips);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
