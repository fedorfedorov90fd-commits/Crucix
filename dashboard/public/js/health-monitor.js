// ============================================================
// МОНИТОРИНГ ЗДРАВООХРАНЕНИЯ — КЛИЕНТСКАЯ ЛОГИКА
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
  label.textContent = '⏳ Сбор данных о вспышках...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/health/update', { method: 'POST' });
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
    const resp = await fetch('/api/health/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderOutbreaks(result.outbreaks);
      updateMap(result.outbreaks);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Health] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.totalOutbreaks || 0;
  document.getElementById('stat-critical').textContent = stats.bySeverity?.critical || 0;
  document.getElementById('stat-cases').textContent = stats.totalCases?.toLocaleString() || 0;
  document.getElementById('stat-deaths').textContent = stats.totalDeaths?.toLocaleString() || 0;
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '🏥 Ожидание данных...';
}

function renderOutbreaks(outbreaks) {
  const container = document.getElementById('outbreaks-list');
  if (!outbreaks || outbreaks.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных о вспышках</div>';
    return;
  }

  let html = '';
  for (const o of outbreaks) {
    const severityClass = `severity-${o.severity}`;
    const severityLabel = o.severity.toUpperCase();
    html += `
      <div class="outbreak-item">
        <span class="disease">${o.icon} ${o.disease}</span>
        <span class="info">${o.country} · ${o.cases} заражений · ${o.deaths} смертей</span>
        <span class="severity ${severityClass}">${severityLabel}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(outbreaks) {
  if (!map) {
    map = L.map('outbreak-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const o of outbreaks) {
    if (o.lat && o.lon) {
      const color = o.severity === 'critical' ? '#ef4444' : 
                    o.severity === 'high' ? '#f97316' : '#eab308';
      const size = o.severity === 'critical' ? 14 : o.severity === 'high' ? 10 : 8;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([o.lat, o.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${o.disease}</strong><br>${o.country}<br>${o.cases} случаев`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ЗДРАВООХРАНЕНИЕ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- ВСПЫШКИ ---\n`;
  document.querySelectorAll('.outbreak-item').forEach(el => {
    const disease = el.querySelector('.disease')?.textContent || '—';
    const info = el.querySelector('.info')?.textContent || '—';
    const severity = el.querySelector('.severity')?.textContent || '—';
    text += `${disease} — ${info} — ${severity}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/health-monitor\n`;
  
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
