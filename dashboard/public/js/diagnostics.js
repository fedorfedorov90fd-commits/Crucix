// ============================================================
// САМОДИАГНОСТИКА — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let currentReport = null;
let isRunning = false;

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

document.getElementById('copy-btn').addEventListener('click', function() {
  if (!currentReport) {
    showNotification('⏳ Сначала запустите диагностику');
    return;
  }
  const text = formatReport(currentReport);
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

function formatReport(report) {
  let text = `=== CRUCIX — ДИАГНОСТИКА СИСТЕМЫ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n`;
  text += `Статус: ${report.overallStatus || 'UNKNOWN'}\n\n`;

  text += '--- МОДУЛИ ---\n';
  for (const m of report.modules || []) {
    const status = m.status === 'ONLINE' ? '🟢' :
                   m.status === 'ERROR' ? '🟡' : '🔴';
    text += `${status} ${m.id}: ${m.status} (${m.responseTime || '—'}ms)\n`;
  }

  text += '\n--- СИСТЕМА ---\n';
  if (report.system) {
    text += `Память: ${report.system.memory?.used || '—'}\n`;
    text += `CPU: ${report.system.cpu?.loadAverage?.join(' ') || '—'}\n`;
    text += `Аптайм: ${report.system.uptime?.process || '—'}\n`;
  }

  if (report.aiLogAnalysis) {
    text += '\n--- AI-АНАЛИЗ ЛОГОВ ---\n';
    text += `Статус: ${report.aiLogAnalysis.status || '—'}\n`;
    text += `Вывод: ${report.aiLogAnalysis.summary || '—'}\n`;
    if (report.aiLogAnalysis.recommendations) {
      text += `Рекомендации: ${report.aiLogAnalysis.recommendations.join('; ')}\n`;
    }
  }

  text += '\n--- CRUCIX OSINT TERMINAL ---\n';
  text += '🌐 http://localhost:3117\n';
  return text;
}

async function loadLatest() {
  try {
    const response = await fetch('/api/diagnostics/latest');
    const data = await response.json();
    if (data.success && data.report) {
      currentReport = data.report;
      renderReport(data.report);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Diagnostics] Ошибка загрузки:', e);
    return false;
  }
}

async function runDiagnostics() {
  if (isRunning) return;
  isRunning = true;

  const btn = document.getElementById('btn-run');
  const label = document.getElementById('status-label');
  btn.textContent = '⏳ Выполняется...';
  btn.disabled = true;
  label.textContent = '⏳ Выполняется диагностика...';
  label.className = 'status-label running';

  try {
    document.getElementById('modules-list').innerHTML = '<div class="loading">⏳ Проверка модулей...</div>';

    const response = await fetch('/api/diagnostics/run');
    const data = await response.json();

    if (data.success && data.result) {
      currentReport = data.result;
      renderReport(data.result);
      showNotification('✅ Диагностика завершена');
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error('[Diagnostics] Ошибка:', e);
    showNotification('❌ Ошибка подключения к серверу');
  } finally {
    isRunning = false;
    btn.textContent = '🔄 Запустить диагностику';
    btn.disabled = false;
    label.textContent = '⏹ Готов к работе';
    label.className = 'status-label';
  }
}

function renderReport(report) {
  const banner = document.getElementById('status-banner');
  const status = report.overallStatus || 'UNKNOWN';
  const statusMap = {
    'ONLINE': ['🟢', 'СИСТЕМА РАБОТАЕТ НОРМАЛЬНО', 'online'],
    'DEGRADED': ['🟡', 'СИСТЕМА РАБОТАЕТ С ОГРАНИЧЕНИЯМИ', 'degraded'],
    'CRITICAL': ['🔴', 'КРИТИЧЕСКОЕ СОСТОЯНИЕ!', 'critical'],
    'UNKNOWN': ['⚪', 'СОСТОЯНИЕ НЕ ОПРЕДЕЛЕНО', 'unknown']
  };
  const info = statusMap[status] || statusMap['UNKNOWN'];
  document.getElementById('status-icon').textContent = info[0];
  document.getElementById('status-text').textContent = info[1];
  banner.className = `status-banner ${info[2]}`;

  const modules = report.modules || [];
  const total = modules.length;
  const online = modules.filter(m => m.status === 'ONLINE').length;
  const error = modules.filter(m => m.status === 'ERROR').length;
  const offline = modules.filter(m => m.status === 'OFFLINE').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-online').textContent = online;
  document.getElementById('stat-error').textContent = error;
  document.getElementById('stat-offline').textContent = offline;
  document.getElementById('stat-time').textContent = new Date(report.timestamp).toLocaleTimeString();

  renderModules(modules);

  if (report.system) {
    document.getElementById('metric-memory').textContent = report.system.memory?.used || '—';
    document.getElementById('metric-cpu').textContent = report.system.cpu?.loadAverage?.join(' / ') || '—';
    document.getElementById('metric-uptime').textContent = report.system.uptime?.process || '—';
    document.getElementById('metric-platform').textContent = report.system.platform || '—';
  }

  renderIntegrity(report.dataIntegrity);
  renderAIAnalysis(report.aiLogAnalysis);
}

function renderModules(modules) {
  const container = document.getElementById('modules-list');

  if (!modules || modules.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных о модулях</div>';
    return;
  }

  const statusMap = {
    'ONLINE': ['🟢', 'online'],
    'ERROR': ['🟡', 'error'],
    'OFFLINE': ['🔴', 'offline']
  };

  let html = '';
  for (const m of modules) {
    const info = statusMap[m.status] || ['⚪', 'unknown'];
    const responseTime = m.responseTime !== null ? `${m.responseTime}ms` : '—';
    const errorInfo = m.error ? `⚠️ ${m.error}` : (m.statusCode ? `HTTP ${m.statusCode}` : '—');

    html += `
      <div class="module-item status-${info[1]}">
        <span class="col-status">${info[0]}</span>
        <span class="col-name">${m.id}</span>
        <span class="col-response">${responseTime}</span>
        <span class="col-info">${errorInfo}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderIntegrity(integrity) {
  const container = document.getElementById('integrity-content');

  if (!integrity) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = '';
  for (const [key, value] of Object.entries(integrity)) {
    const status = value.status || 'UNKNOWN';
    const statusClass = status === 'OK' ? 'ok' :
                        status === 'ERROR' ? 'error' :
                        status === 'WARNING' ? 'warning' : '';
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    const info = value.error || value.files || value.entries || '—';

    html += `
      <div class="integrity-item">
        <span class="label">${label}</span>
        <span class="value ${statusClass}">${status} (${info})</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderAIAnalysis(ai) {
  const container = document.getElementById('ai-content');

  if (!ai) {
    container.innerHTML = '<div class="empty">AI-анализ не выполнен</div>';
    return;
  }

  if (ai.status === 'NO_LOGS') {
    container.innerHTML = `<div class="empty">📭 ${ai.message || 'Логи не найдены'}</div>`;
    return;
  }

  if (ai.status === 'AI_UNAVAILABLE') {
    container.innerHTML = `<div class="empty">⚠️ ${ai.message || 'Ollama не доступен'}</div>`;
    return;
  }

  if (ai.status === 'ERROR' || ai.status === 'PARSING_ERROR') {
    container.innerHTML = `<div class="empty">⚠️ ${ai.message || ai.raw || 'Ошибка анализа'}</div>`;
    return;
  }

  const statusClass = ai.status === 'STABLE' ? 'stable' :
                      ai.status === 'WARNING' ? 'warning' : 'critical';
  const statusMap = {
    'STABLE': '🟢 Стабильно',
    'WARNING': '🟡 Есть предупреждения',
    'CRITICAL': '🔴 Критические проблемы'
  };

  let html = `
    <div class="ai-status ${statusClass}">${statusMap[ai.status] || ai.status}</div>
    <div class="ai-summary">${ai.summary || '—'}</div>
  `;

  if (ai.issues && ai.issues.length > 0) {
    html += `<ul class="ai-issues">${ai.issues.map(i => `<li>⚠️ ${i}</li>`).join('')}</ul>`;
  }

  if (ai.recommendations && ai.recommendations.length > 0) {
    html += `<ul class="ai-recommendations">${ai.recommendations.map(r => `<li>✅ ${r}</li>`).join('')}</ul>`;
  }

  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-run').addEventListener('click', runDiagnostics);
  document.getElementById('btn-refresh').addEventListener('click', loadLatest);

  loadLatest().then(found => {
    if (!found) {
      document.getElementById('modules-list').innerHTML = '<div class="empty">Запустите диагностику для проверки модулей</div>';
    }
  });
});
