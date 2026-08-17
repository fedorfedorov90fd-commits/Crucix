// ============================================================
// КИБЕРУГРОЗЫ — КЛИЕНТСКАЯ ЛОГИКА
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

async function updateThreats() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Сканирование...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор угроз...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/cyber/update', { method: 'POST' });
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
    btn.textContent = '🔄 Сканировать угрозы';
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
    const resp = await fetch('/api/cyber/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderThreats(result.threats);
      updateMap(result.threats);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Cyber Threats] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-critical').textContent = stats.bySeverity?.critical || 0;
  document.getElementById('stat-high').textContent = stats.bySeverity?.high || 0;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '🟢 Активных критических угроз не обнаружено.';
}

function renderThreats(threats) {
  const container = document.getElementById('threats-list');
  if (!threats || threats.length === 0) {
    container.innerHTML = '<div class="empty">Угроз не обнаружено</div>';
    return;
  }

  const severityMap = {
    critical: { label: 'КРИТИЧЕСКАЯ', class: 'severity-critical' },
    high: { label: 'ВЫСОКИЙ', class: 'severity-high' },
    medium: { label: 'СРЕДНИЙ', class: 'severity-medium' },
    low: { label: 'НИЗКИЙ', class: 'severity-low' }
  };

  let html = '';
  for (const t of threats) {
    const sev = severityMap[t.severity] || severityMap.medium;
    const icon = t.type === 'c2' ? '🖥️' : t.type === 'malware' ? '🦠' : t.type === 'vulnerability' ? '🔓' : '💥';
    html += `
      <div class="threat-item" style="border-left-color: ${t.severity === 'critical' ? '#ef4444' : t.severity === 'high' ? '#f97316' : '#eab308'}">
        <span class="severity">${icon}</span>
        <div class="info">
          <div class="name">${t.name}</div>
          <div class="desc">${t.description}</div>
          <div class="meta">${t.source || 'Неизвестно'} · ${t.vendor || '—'} · ${new Date(t.date).toLocaleString()}</div>
        </div>
        <span class="severity-label ${sev.class}">${sev.label}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(threats) {
  if (!map) {
    map = L.map('threat-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  for (const t of threats) {
    if (t.lat && t.lon) {
      const color = t.severity === 'critical' ? '#ef4444' : t.severity === 'high' ? '#f97316' : '#eab308';
      const size = t.severity === 'critical' ? 14 : t.severity === 'high' ? 10 : 8;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px ${color}40;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([t.lat, t.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${t.name}</strong><br>${t.severity.toUpperCase()} риск`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — КИБЕРУГРОЗЫ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- УГРОЗЫ ---\n`;
  document.querySelectorAll('.threat-item').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const sev = el.querySelector('.severity-label')?.textContent || '—';
    text += `${name} — ${sev}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/cyber-threats\n`;
  
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
  document.getElementById('btn-update').addEventListener('click', updateThreats);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
