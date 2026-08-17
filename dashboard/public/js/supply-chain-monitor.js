// ============================================================
// ЦЕПИ ПОСТАВОК — КЛИЕНТСКАЯ ЛОГИКА
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

async function updateData() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных о цепях поставок...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/supply-chain/update', { method: 'POST' });
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
    const resp = await fetch('/api/supply-chain/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderData(result.data);
      updateMap(result.data);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Supply Chain] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-index').textContent = stats.avgIndex || 0;
  document.getElementById('stat-critical').textContent = stats.byStatus?.critical || 0;
  document.getElementById('stat-high').textContent = stats.byStatus?.high || 0;
  document.getElementById('stat-total').textContent = stats.totalRecords || 0;
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '📦 Ожидание данных...';
}

function renderData(data) {
  const container = document.getElementById('data-list');
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = '';
  for (const item of data) {
    const statusClass = `status-${item.status}`;
    html += `
      <div class="data-item">
        <span class="region">${item.regionName}</span>
        <span class="sector">${item.sector}</span>
        <span class="index" style="color:${item.color}">${item.index}</span>
        <span class="status ${statusClass}">${item.statusLabel}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(data) {
  if (!map) {
    map = L.map('chain-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const regionData = {};
  for (const item of data) {
    if (!regionData[item.regionName]) {
      regionData[item.regionName] = { lat: item.lat, lon: item.lon, total: 0, count: 0 };
    }
    regionData[item.regionName].total += item.index;
    regionData[item.regionName].count++;
  }

  for (const [region, d] of Object.entries(regionData)) {
    if (d.lat && d.lon) {
      const avg = Math.round(d.total / d.count);
      const size = 8 + (avg / 10) * 2;
      const color = avg >= 75 ? '#ef4444' : avg >= 60 ? '#f97316' : avg >= 40 ? '#eab308' : '#22c55e';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([d.lat, d.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${region}</strong><br>Индекс: ${avg}`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ЦЕПИ ПОСТАВОК ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- ДАННЫЕ ---\n`;
  document.querySelectorAll('.data-item').forEach(el => {
    const region = el.querySelector('.region')?.textContent || '—';
    const sector = el.querySelector('.sector')?.textContent || '—';
    const index = el.querySelector('.index')?.textContent || '—';
    const status = el.querySelector('.status')?.textContent || '—';
    text += `${region} · ${sector} — индекс: ${index} (${status})\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/supply-chain-monitor\n`;
  
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
