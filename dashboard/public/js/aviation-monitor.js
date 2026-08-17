// ============================================================
// МОНИТОРИНГ АВИАЦИИ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let map = null;
let markers = [];
let flightIcons = {};

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

async function updateFlights() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных о рейсах...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/aviation/update', { method: 'POST' });
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
    const resp = await fetch('/api/aviation/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderFlights(result.flights);
      renderAnomalies(result.anomalies);
      updateMap(result.flights);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Aviation] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.totalFlights || 0;
  document.getElementById('stat-military').textContent = stats.byType?.military || 0;
  document.getElementById('stat-anomalies').textContent = stats.anomalies || 0;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '✈️ Загрузка данных...';
}

function renderFlights(flights) {
  const container = document.getElementById('flights-list');
  if (!flights || flights.length === 0) {
    container.innerHTML = '<div class="empty">Нет активных рейсов</div>';
    return;
  }

  let html = '';
  for (const f of flights) {
    const anomalyIcon = f.anomaly ? f.anomaly.icon : '';
    html += `
      <div class="flight-item">
        <span class="icon">${f.icon || '✈️'}</span>
        <span class="callsign">${f.callsign}</span>
        <span class="info">${f.typeLabel} · ${Math.round(f.altitude/1000)}K ft · ${Math.round(f.speed)} kts</span>
        ${anomalyIcon ? `<span style="color:#ef4444;">${anomalyIcon}</span>` : ''}
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderAnomalies(anomalies) {
  const container = document.getElementById('anomalies-list');
  if (!anomalies || anomalies.length === 0) {
    container.innerHTML = '<div class="empty">✅ Аномалий не обнаружено</div>';
    return;
  }

  let html = '';
  for (const a of anomalies) {
    html += `
      <div class="anomaly-item" style="border-left-color: ${a.anomaly?.color || '#ef4444'}">
        <span>${a.anomaly?.icon || '⚠️'}</span>
        <span class="severity" style="color:${a.anomaly?.color || '#ef4444'}">${a.anomaly?.name || 'Аномалия'}</span>
        <span class="desc">${a.callsign} — ${a.anomaly?.description || ''}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(flights) {
  if (!map) {
    map = L.map('flights-map').setView([55.75, 37.62], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const f of flights) {
    if (f.lat && f.lon) {
      const color = f.anomaly ? f.anomaly.color : f.color || '#6b7280';
      const size = f.anomaly ? 14 : 10;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:8px;">${f.anomaly ? '⚠️' : ''}</div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([f.lat, f.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${f.callsign}</strong><br>${f.typeLabel}<br>${Math.round(f.altitude)} ft<br>${Math.round(f.speed)} kts${f.anomaly ? `<br><span style="color:#ef4444;">⚠️ ${f.anomaly.name}</span>` : ''}`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — МОНИТОРИНГ АВИАЦИИ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- РЕЙСЫ ---\n`;
  document.querySelectorAll('.flight-item').forEach(el => {
    const callsign = el.querySelector('.callsign')?.textContent || '—';
    const info = el.querySelector('.info')?.textContent || '—';
    text += `${callsign} — ${info}\n`;
  });
  
  text += `\n--- АНОМАЛИИ ---\n`;
  document.querySelectorAll('.anomaly-item').forEach(el => {
    const textContent = el.textContent?.trim() || '—';
    text += `${textContent}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/aviation-monitor\n`;
  
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
  document.getElementById('btn-update').addEventListener('click', updateFlights);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
