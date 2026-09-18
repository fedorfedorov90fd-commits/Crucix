// ============================================================
// АВТОМАТИЧЕСКИЕ ОТЧЁТЫ — КЛИЕНТСКАЯ ЛОГИКА
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

async function generateReport() {
  const btn = document.getElementById('btn-generate');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Генерация...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор данных...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/reports/generate', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'daily' })
    });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Отчёт создан!');
      await loadData();
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '📄 Создать отчёт';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

async function startAutoUpdate() {
  try {
    const resp = await fetch('/api/reports/start-auto', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Автообновление запущено');
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  }
}

async function stopAutoUpdate() {
  try {
    const resp = await fetch('/api/reports/stop-auto', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('⏹ Автообновление остановлено');
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  }
}

function renderReport(report) {
  const container = document.getElementById('report-content');
  if (!report) {
    container.innerHTML = '<div class="empty">Нет отчётов</div>';
    return;
  }

  const summary = report.summary || 'Отчёт создан';
  container.innerHTML = `
    <div class="summary">${summary.replace(/\n/g, '<br>')}</div>
    <div style="margin-top:12px;font-size:11px;color:#555;">
      ID: ${report.id} · ${new Date(report.timestamp).toLocaleString()}
    </div>
  `;
}

function renderHistory(history) {
  const container = document.getElementById('history-content');
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty">История пуста</div>';
    return;
  }

  let html = '';
  for (const h of history.slice().reverse()) {
    const date = new Date(h.timestamp).toLocaleString();
    html += `
      <div class="history-item">
        <span class="date">${date}</span>
        <span class="summary">${h.summary?.slice(0, 80) || 'Отчёт'}${h.summary?.length > 80 ? '...' : ''}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function loadStats() {
  try {
    const resp = await fetch('/api/reports/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalReports || 0;
      document.getElementById('stat-history').textContent = data.stats.historyEntries || 0;
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
    }
  } catch (e) {
    console.error('[Reports] Ошибка загрузки статистики:', e);
  }
}

async function loadLatest() {
  try {
    const resp = await fetch('/api/reports/latest');
    const data = await resp.json();
    if (data.success && data.report) {
      renderReport(data.report);
    }
  } catch (e) {
    console.error('[Reports] Ошибка загрузки отчёта:', e);
  }
}

async function loadHistory() {
  try {
    const resp = await fetch('/api/reports/history?limit=10');
    const data = await resp.json();
    if (data.success) {
      renderHistory(data.history);
    }
  } catch (e) {
    console.error('[Reports] Ошибка загрузки истории:', e);
  }
}

async function loadData() {
  await loadStats();
  await loadLatest();
  await loadHistory();
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  const summary = document.querySelector('.summary')?.textContent || 'Нет данных';
  let text = `=== CRUCIX — АВТОМАТИЧЕСКИЕ ОТЧЁТЫ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  text += `--- ОТЧЁТ ---\n`;
  text += summary + '\n';
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/automated-reports\n`;
  
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
  document.getElementById('btn-generate').addEventListener('click', generateReport);
  document.getElementById('btn-start-auto').addEventListener('click', startAutoUpdate);
  document.getElementById('btn-stop-auto').addEventListener('click', stopAutoUpdate);
  document.getElementById('btn-refresh').addEventListener('click', loadData);
  
  loadData();
});
