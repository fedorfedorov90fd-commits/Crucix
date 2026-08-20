// ============================================================
// СТРАТЕГИЧЕСКИЙ СЛОЙ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let map = null;
let markers = [];
let currentLayers = ['bases', 'nuclear', 'cables', 'assets', 'buffers'];

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

async function loadStrategic() {
  try {
    const [basesRes, nuclearRes, cablesRes, assetsRes, alertsRes, ssiRes] = await Promise.all([
      fetch('/api/strategic/bases'),
      fetch('/api/strategic/nuclear'),
      fetch('/api/strategic/cables'),
      fetch('/api/strategic/assets'),
      fetch('/api/strategic/alerts'),
      fetch('/api/strategic/ssi')
    ]);

    const bases = await basesRes.json();
    const nuclear = await nuclearRes.json();
    const cables = await cablesRes.json();
    const assets = await assetsRes.json();
    const alerts = await alertsRes.json();
    const ssi = await ssiRes.json();

    document.getElementById('stat-bases').textContent = bases.total || 0;
    document.getElementById('stat-nuclear').textContent = nuclear.total || 0;
    document.getElementById('stat-cables').textContent = cables.total || 0;
    document.getElementById('stat-assets').textContent = assets.total || 0;
    document.getElementById('stat-ssi').textContent = ssi.ssi + '%';
    document.getElementById('stat-alerts').textContent = alerts.total || 0;

    const fill = document.getElementById('ssi-fill');
    const label = document.getElementById('ssi-label');
    fill.style.width = ssi.ssi + '%';
    const level = ssi.level || 'НИЗКИЙ';
    label.textContent = level;
    label.style.color = ssi.ssi > 80 ? '#ef4444' : ssi.ssi > 60 ? '#f97316' : ssi.ssi > 40 ? '#ffd700' : '#22c55e';

    updateMap(bases.bases || [], nuclear.nuclear || [], cables.cables || [], assets.assets || []);
    renderAlerts(alerts.alerts || []);

    document.getElementById('status-label').textContent = `✅ ${new Date().toLocaleTimeString()}`;
    document.getElementById('status-label').className = 'status-label';

  } catch (e) {
    console.error('[Strategic Layer] Ошибка загрузки:', e);
    document.getElementById('status-label').textContent = '❌ Ошибка';
    document.getElementById('status-label').className = 'status-label';
  }
}

function updateMap(bases, nuclear, cables, assets) {
  const container = document.getElementById('strategic-map');
  
  if (map) {
    map.remove();
    map = null;
  }

  // Принудительно устанавливаем стили
  container.style.display = 'block';
  container.style.height = '500px';
  container.style.width = '100%';
  container.style.backgroundColor = '#1a1a2e';
  container.style.borderRadius = '4px';

  // Создаём карту
  map = L.map('strategic-map', {
    center: [30, 20],
    zoom: 2,
    zoomControl: true,
    fadeAnimation: true,
    attributionControl: true,
    minZoom: 1,
    maxZoom: 18
  });

  // ИСПОЛЬЗУЕМ HTTPS OpenStreetMap (самый надёжный)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 1,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // ЧИСТИМ МАРКЕРЫ
  markers = [];

  // 1. Военные базы (зелёные)
  if (currentLayers.includes('bases')) {
    for (const base of bases) {
      if (!base.lat || !base.lon) continue;
      const color = base.status === 'active' ? '#22c55e' : '#6b7280';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 20px ${color}60;cursor:pointer;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      const marker = L.marker([base.lat, base.lon], { icon })
        .addTo(map)
        .bindPopup(`<strong>${base.name}</strong><br>${base.country}<br>${base.type} | ${base.personnel || '—'} чел.`);
      markers.push(marker);
    }
  }

  // 2. Ядерные объекты (красные)
  if (currentLayers.includes('nuclear')) {
    for (const nuke of nuclear) {
      if (!nuke.lat || !nuke.lon) continue;
      const color = nuke.status === 'damaged' ? '#ef4444' : nuke.status === 'shutdown' ? '#f97316' : '#ffd700';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 30px ${color}80;animation:pulse 2s infinite;cursor:pointer;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const marker = L.marker([nuke.lat, nuke.lon], { icon })
        .addTo(map)
        .bindPopup(`<strong>☢️ ${nuke.name}</strong><br>${nuke.country}<br>Статус: ${nuke.status}`);
      markers.push(marker);
    }
  }

  // 3. Подводные кабели (синие линии)
  if (currentLayers.includes('cables')) {
    for (const cable of cables) {
      if (!cable.lat_start || !cable.lon_start || !cable.lat_end || !cable.lon_end) continue;
      const color = cable.vulnerability === 'high' ? '#ef4444' : '#22d3ee';
      const line = L.polyline([
        [cable.lat_start, cable.lon_start],
        [cable.lat_end, cable.lon_end]
      ], {
        color: color,
        weight: 3,
        opacity: 0.7,
        dashArray: cable.vulnerability === 'high' ? '10,5' : null
      }).addTo(map)
        .bindPopup(`<strong>🌊 ${cable.name}</strong><br>${cable.length}км | ${cable.capacity} Тбит/с`);
      markers.push(line);
    }
  }

  // 4. Стратегические объекты (жёлтые)
  if (currentLayers.includes('assets')) {
    for (const asset of assets) {
      if (!asset.lat || !asset.lon) continue;
      const color = asset.strategic_value === 'critical' ? '#ef4444' : '#f97316';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.4);box-shadow:0 0 25px ${color}60;cursor:pointer;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      const marker = L.marker([asset.lat, asset.lon], { icon })
        .addTo(map)
        .bindPopup(`<strong>${asset.name}</strong><br>${asset.country}<br>${asset.type}`);
      markers.push(marker);
    }
  }

  // Обновляем размер
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 300);
}

function renderAlerts(alerts) {
  const container = document.getElementById('alerts-list');
  if (!alerts || alerts.length === 0) {
    container.innerHTML = '<div class="empty">✅ Активных предупреждений нет</div>';
    return;
  }
  let html = '';
  const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
  const sorted = [...alerts].sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));
  
  for (const alert of sorted) {
    const sevClass = alert.severity === 'CRITICAL' ? 'sev-high' :
                     alert.severity === 'HIGH' ? 'sev-high' :
                     alert.severity === 'MEDIUM' ? 'sev-medium' : 'sev-low';
    const label = alert.base || alert.site || alert.asset || alert.type || '';
    const detail = alert.distance ? `(${alert.distance}км)` : '';
    
    const emoji = alert.type === 'cable_intercept_risk' ? '🔌' :
                  alert.type === 'nuclear_incident_risk' ? '☢️' :
                  alert.type === 'oil_terminal' ? '🛢️' :
                  alert.type === 'gas_pipeline' ? '🔥' :
                  alert.type === 'port' ? '⚓' : '⚠️';
    
    html += `
      <div class="alert-item ${sevClass}">
        <span style="font-size:14px;">${emoji}</span>
        <strong>${alert.type.replace('_', ' ').toUpperCase()}</strong><br>
        ${label} ${detail}
        <span style="color:${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? '#ef4444' : '#f97316'};font-weight:600;">
          [${alert.severity}]
        </span>
      </div>
    `;
  }
  container.innerHTML = html;
}

// Управление слоями
document.querySelectorAll('.layer-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const layer = this.dataset.layer;
    this.classList.toggle('active');
    const index = currentLayers.indexOf(layer);
    if (index > -1) {
      currentLayers.splice(index, 1);
    } else {
      currentLayers.push(layer);
    }
    showNotification(`Слой ${layer}: ${this.classList.contains('active') ? 'включён' : 'выключен'}`);
    loadStrategic();
  });
});

// Анализ сценариев
document.getElementById('btn-scenario').addEventListener('click', async function() {
  const select = document.getElementById('scenario-select');
  const type = select.value;
  const target = select.options[select.selectedIndex].text;

  const container = document.getElementById('scenario-result');
  container.innerHTML = '<div class="loading">⏳ Анализ...</div>';

  try {
    const resp = await fetch('/api/strategic/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, target: target })
    });
    const data = await resp.json();

    if (data.success) {
      const r = data.result;
      if (r.error) {
        container.innerHTML = `<div style="color:#ef4444;">${r.error}</div>`;
      } else {
        let html = `<div class="impact">⚠️ ${r.impact || 'Анализ завершён'}</div>`;
        if (r.timeline) {
          html += `
            <div style="margin-top:8px;font-size:12px;">
              <div><strong>Немедленно:</strong> ${r.timeline.immediate || '—'}</div>
              <div><strong>Краткосрочно:</strong> ${r.timeline.short_term || '—'}</div>
              <div><strong>Долгосрочно:</strong> ${r.timeline.long_term || '—'}</div>
            </div>
          `;
        }
        if (r.recommendations && r.recommendations.length > 0) {
          html += `
            <div style="margin-top:8px;">
              <strong>Рекомендации:</strong>
              ${r.recommendations.map(r => `<div class="rec">✅ ${r}</div>`).join('')}
            </div>
          `;
        }
        container.innerHTML = html;
      }
    } else {
      container.innerHTML = `<div style="color:#ef4444;">Ошибка: ${data.error}</div>`;
    }
  } catch (e) {
    container.innerHTML = `<div style="color:#ef4444;">Ошибка: ${e.message}</div>`;
  }
});

// Копирование
document.getElementById('copy-btn').addEventListener('click', function() {
  const text = `=== CRUCIX — СТРАТЕГИЧЕСКИЙ СЛОЙ ===
Дата: ${new Date().toLocaleString()}

--- СТАТИСТИКА ---
Военные базы: ${document.getElementById('stat-bases').textContent}
Ядерные объекты: ${document.getElementById('stat-nuclear').textContent}
Подводные кабели: ${document.getElementById('stat-cables').textContent}
Стратегические объекты: ${document.getElementById('stat-assets').textContent}
Индекс напряжённости: ${document.getElementById('stat-ssi').textContent}
Активные предупреждения: ${document.getElementById('stat-alerts').textContent}

--- CRUCIX OSINT TERMINAL ---
🌐 http://localhost:3117/strategic-layer`;

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

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-refresh').addEventListener('click', loadStrategic);
  loadStrategic();
});

// Добавляем стили
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.7; }
  }
  .custom-tooltip {
    background: rgba(10,10,20,0.92) !important;
    color: #c8d0d8 !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    font-size: 12px !important;
    font-family: monospace !important;
  }
  .custom-tooltip strong {
    color: #5bc0f8 !important;
  }
  .leaflet-tile-pane {
    filter: brightness(0.9) contrast(1.1);
  }
  .leaflet-popup-content-wrapper {
    background: rgba(10,10,20,0.92) !important;
    color: #c8d0d8 !important;
    border-radius: 6px !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
  }
  .leaflet-popup-tip {
    background: rgba(10,10,20,0.92) !important;
  }
  .leaflet-control-zoom {
    border: 1px solid rgba(255,255,255,0.1) !important;
  }
  .leaflet-control-zoom a {
    background: rgba(10,10,20,0.8) !important;
    color: #c8d0d8 !important;
  }
  .leaflet-control-attribution {
    background: rgba(10,10,20,0.8) !important;
    color: #666 !important;
    font-size: 9px !important;
  }
  .leaflet-control-attribution a {
    color: #5bc0f8 !important;
  }
`;
document.head.appendChild(style);

console.log('[Strategic Layer] ✅ Загружен');
