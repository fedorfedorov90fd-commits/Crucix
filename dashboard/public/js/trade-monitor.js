// ============================================================
// МОНИТОРИНГ ТОРГОВЛИ — КЛИЕНТСКАЯ ЛОГИКА
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
  label.textContent = '⏳ Сбор торговых данных...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/trade/update', { method: 'POST' });
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
    const resp = await fetch('/api/trade/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderTrade(result.trade);
      updateMap(result.trade);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Trade] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-export').textContent = `$${Math.round(stats.totalExport).toLocaleString()} млрд`;
  document.getElementById('stat-import').textContent = `$${Math.round(stats.totalImport).toLocaleString()} млрд`;
  document.getElementById('stat-balance').textContent = `$${Math.round(stats.totalBalance).toLocaleString()} млрд`;
  document.getElementById('stat-countries').textContent = stats.countries || 0;
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '📊 Ожидание данных...';
}

function renderTrade(trade) {
  const container = document.getElementById('trade-list');
  if (!trade || trade.length === 0) {
    container.innerHTML = '<div class="empty">Нет торговых данных</div>';
    return;
  }

  let html = '';
  for (const t of trade) {
    const balanceClass = t.balance >= 0 ? 'positive' : 'negative';
    html += `
      <div class="trade-item">
        <span class="country">${t.country}</span>
        <span class="commodity">${t.commodity}</span>
        <span class="values">📤 $${t.export} млрд · 📥 $${t.import} млрд</span>
        <span class="balance ${balanceClass}">${t.balance >= 0 ? '+' : ''}${t.balance}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateMap(trade) {
  if (!map) {
    map = L.map('trade-map').setView([30, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const countryData = {};
  for (const t of trade) {
    if (!countryData[t.country]) {
      countryData[t.country] = { lat: t.lat, lon: t.lon, total: 0 };
    }
    countryData[t.country].total += t.total;
  }

  for (const [country, data] of Object.entries(countryData)) {
    if (data.lat && data.lon) {
      const size = 8 + Math.min(data.total / 50, 20);
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background:#f59e0b;border-radius:50%;border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 20px rgba(245,158,11,0.3);cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
      });

      const marker = L.marker([data.lat, data.lon], { icon })
        .addTo(map)
        .bindTooltip(`<strong>${country}</strong><br>Торговля: $${Math.round(data.total).toLocaleString()} млрд`, {
          direction: 'top',
          offset: [0, -10]
        });

      markers.push(marker);
    }
  }
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ТОРГОВЛЯ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- ТОРГОВЛЯ ---\n`;
  document.querySelectorAll('.trade-item').forEach(el => {
    const country = el.querySelector('.country')?.textContent || '—';
    const commodity = el.querySelector('.commodity')?.textContent || '—';
    const values = el.querySelector('.values')?.textContent || '—';
    const balance = el.querySelector('.balance')?.textContent || '—';
    text += `${country} · ${commodity} — ${values} (баланс: ${balance})\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/trade-monitor\n`;
  
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
