// ============================================================
// СТРАТЕГИЧЕСКАЯ РАЗВЕДКА — КЛИЕНТСКАЯ ЛОГИКА
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

async function updateData() {
  const btn = document.getElementById('btn-update');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  label.textContent = '⏳ Сбор аналитических отчётов...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/strategic-intel/update', { method: 'POST' });
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
    const resp = await fetch('/api/strategic-intel/latest');
    const data = await resp.json();
    if (data.success) {
      const result = data.result;
      renderSummary(result);
      renderReports(result.reports);
      updateStats(result.stats);
    }
  } catch (e) {
    console.error('[Strategic Intel] Ошибка загрузки:', e);
  }
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.totalReports || 0;
  document.getElementById('stat-thinktanks').textContent = stats.thinkTanks || 0;
  document.getElementById('stat-high').textContent = stats.byPriority?.high || 0;
  document.getElementById('stat-last').textContent = new Date().toLocaleString();
}

function renderSummary(result) {
  const container = document.getElementById('summary-content');
  container.innerHTML = result.summary || '📊 Ожидание данных...';
}

function renderReports(reports) {
  const container = document.getElementById('reports-grid');
  if (!reports || reports.length === 0) {
    container.innerHTML = '<div class="empty">Нет аналитических отчётов</div>';
    return;
  }

  const priorityNames = { high: '🔴 Высокий', medium: '🟡 Средний', low: '🟢 Низкий' };

  let html = '';
  for (const report of reports) {
    const priorityClass = `priority-${report.priority}`;
    const tags = (report.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    
    html += `
      <div class="report-card ${priorityClass}">
        <div class="header">
          <span class="thinktank">${report.thinkTankName}</span>
          <span style="font-size:11px;color:#666;">${report.date}</span>
        </div>
        <div class="title">${report.title}</div>
        <div class="summary">${report.summary}</div>
        <div class="meta">Регион: ${report.region} · Уверенность: ${report.confidence}%</div>
        <div class="tags">${tags}</div>
        <div style="font-size:11px;color:#888;margin-top:6px;">${priorityNames[report.priority] || report.priority}</div>
      </div>
    `;
  }
  container.innerHTML = html;
}

// КНОПКА КОПИРОВАНИЯ
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — СТРАТЕГИЧЕСКАЯ РАЗВЕДКА ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  
  text += `--- ОТЧЁТЫ ---\n`;
  document.querySelectorAll('.report-card').forEach(el => {
    const thinktank = el.querySelector('.thinktank')?.textContent || '—';
    const title = el.querySelector('.title')?.textContent || '—';
    const summary = el.querySelector('.summary')?.textContent || '—';
    text += `${thinktank}: ${title} — ${summary}\n`;
  });
  
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/strategic-intel\n`;
  
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
