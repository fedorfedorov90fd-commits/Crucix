// ============================================================
// ГЕНЕРАТОР СЦЕНАРИЕВ — КЛИЕНТСКАЯ ЛОГИКА
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

async function generateScenarios() {
  const btn = document.getElementById('btn-generate');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Генерация...';
  btn.disabled = true;
  label.textContent = '⏳ AI-генерация сценариев...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/scenario-generator/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Сценарии сгенерированы!');
      await loadData();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🎲 Сгенерировать сценарии';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

async function loadData() {
  await loadStats();
  await loadScenarios();
}

async function loadStats() {
  try {
    const resp = await fetch('/api/scenario-generator/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalScenarios || 0;
      document.getElementById('stat-likely').textContent = data.stats.byStatus?.likely || 0;
      document.getElementById('stat-probability').textContent = `${data.stats.avgProbability || 0}%`;
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
    }
  } catch (e) {
    console.error('[Scenario] Ошибка загрузки статистики:', e);
  }
}

async function loadScenarios() {
  try {
    const resp = await fetch('/api/scenario-generator/scenarios');
    const data = await resp.json();
    if (data.success) {
      renderScenarios(data.scenarios);
      if (data.scenarios && data.scenarios.length > 0) {
        const summary = await fetch('/api/scenario-generator/latest');
        const summaryData = await summary.json();
        if (summaryData.success && summaryData.result) {
          document.getElementById('summary-content').innerHTML = summaryData.result.summary || '🎯 Ожидание данных...';
        }
      }
    }
  } catch (e) {
    console.error('[Scenario] Ошибка загрузки сценариев:', e);
  }
}

function renderScenarios(scenarios) {
  const container = document.getElementById('scenarios-list');
  if (!scenarios || scenarios.length === 0) {
    container.innerHTML = '<div class="empty">Нет сценариев. Нажмите "Сгенерировать сценарии".</div>';
    return;
  }

  let html = '';
  for (const s of scenarios) {
    const statusClass = `status-${s.status}`;
    const statusLabel = s.statusLabel || s.status;
    const probColor = s.probability > 70 ? '#ef4444' : s.probability > 40 ? '#f97316' : '#22c55e';
    
    html += `
      <div class="scenario-item" style="border-left-color: ${s.color || '#6b7280'}">
        <div class="icon">${s.icon || '🎯'}</div>
        <div class="info">
          <div class="title">${s.title}</div>
          <div class="desc">${s.description}</div>
          <div class="meta">${s.categoryName} · ${s.horizon} · ${new Date(s.timestamp).toLocaleString()}</div>
        </div>
        <div class="stats">
          <div class="probability" style="color:${probColor}">${s.probability}%</div>
          <div class="impact">💥 ${s.impact}% влияние</div>
          <span class="status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ГЕНЕРАТОР СЦЕНАРИЕВ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- СЦЕНАРИИ ---\n`;
  document.querySelectorAll('.scenario-item').forEach(el => {
    const title = el.querySelector('.title')?.textContent || '—';
    const desc = el.querySelector('.desc')?.textContent || '—';
    const prob = el.querySelector('.probability')?.textContent || '—';
    const impact = el.querySelector('.impact')?.textContent || '—';
    const status = el.querySelector('.status')?.textContent || '—';
    text += `${title} — ${desc} — ${prob} — ${impact} — ${status}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/scenario-generator\n`;
  
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
  document.getElementById('btn-generate').addEventListener('click', generateScenarios);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  loadData();
});
