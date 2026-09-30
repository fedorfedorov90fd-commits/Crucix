// ============================================================
// РАСШИРЕННАЯ ДИАГНОСТИКА — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let currentReport = null;
let isRunning = false;

// ============================================================
// 1. ВРЕМЯ
// ============================================================
function updateTopbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  document.getElementById('topbar-date').textContent = `${dateStr} ${timeStr}`;
}
updateTopbar();
setInterval(updateTopbar, 60000);

// ============================================================
// 2. УВЕДОМЛЕНИЯ
// ============================================================
function showNotification(msg) {
  document.querySelectorAll('.notification').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ============================================================
// 3. КООРДИНАТНАЯ СЕТКА
// ============================================================
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

// ============================================================
// 4. КОПИРОВАНИЕ — ВСЕГДА РАБОТАЕТ!
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  copyPageData();
});

function copyPageData() {
  try {
    const data = collectPageData();
    const text = formatDataForCopy(data);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Данные скопированы в буфер обмена');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  } catch (e) {
    console.error('[Copy] Ошибка:', e);
    showNotification('❌ Ошибка копирования');
    // Даже при ошибке пытаемся скопировать то, что есть
    fallbackCopy('=== CRUCIX — ДИАГНОСТИКА ===\nОшибка копирования данных\n' + new Date().toLocaleString());
  }
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  area.style.top = '-9999px';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
    showNotification('✅ Данные скопированы');
  } catch (e) {
    showNotification('❌ Ошибка копирования');
    console.error('[Copy] Fallback ошибка:', e);
  }
  document.body.removeChild(area);
}

function collectPageData() {
  const data = {
    title: document.title,
    time: new Date().toLocaleString(),
    status: document.getElementById('status-text')?.textContent || 'Неизвестно',
    modules: [],
    system: {},
    integrity: {},
    aiAnalysis: {},
    pages: []
  };

  // Собираем API-модули
  document.querySelectorAll('.module-item-d').forEach(el => {
    const name = el.querySelector('span:first-child')?.textContent || '—';
    const statusEl = el.querySelector('.status');
    const timeEl = el.querySelector('.time');
    data.modules.push({
      name: name,
      status: statusEl?.textContent || '—',
      time: timeEl?.textContent || '—'
    });
  });

  // Если модулей нет — пробуем собрать из другого селектора
  if (data.modules.length === 0) {
    document.querySelectorAll('#modules-grid .module-item-d').forEach(el => {
      const name = el.querySelector('span:first-child')?.textContent || '—';
      const statusEl = el.querySelector('.status');
      const timeEl = el.querySelector('.time');
      data.modules.push({
        name: name,
        status: statusEl?.textContent || '—',
        time: timeEl?.textContent || '—'
      });
    });
  }

  // Собираем системные метрики
  document.querySelectorAll('.metric-card').forEach(el => {
    const label = el.querySelector('.label')?.textContent || '—';
    const value = el.querySelector('.value')?.textContent || '—';
    data.system[label] = value;
  });

  // Собираем целостность данных
  document.querySelectorAll('.integrity-item').forEach(el => {
    const label = el.querySelector('span:first-child')?.textContent || '—';
    const value = el.querySelector('span:last-child')?.textContent || '—';
    data.integrity[label] = value;
  });

  // Собираем AI-анализ
  const aiContainer = document.getElementById('ai-analysis');
  if (aiContainer) {
    const summary = aiContainer.querySelector('.summary')?.textContent || '';
    const issues = [];
    const recommendations = [];
    aiContainer.querySelectorAll('.issues li').forEach(el => issues.push(el.textContent));
    aiContainer.querySelectorAll('.recommendations li').forEach(el => recommendations.push(el.textContent));
    data.aiAnalysis = { summary, issues, recommendations };
  }

  // Собираем страницы
  document.querySelectorAll('#pages-grid .module-item-d').forEach(el => {
    const path = el.querySelector('span:first-child')?.textContent || '—';
    const statusEl = el.querySelector('.status');
    const timeEl = el.querySelector('.time');
    data.pages.push({
      path: path,
      status: statusEl?.textContent || '—',
      time: timeEl?.textContent || '—'
    });
  });

  return data;
}

function formatDataForCopy(data) {
  let text = `=== ${data.title} ===\n`;
  text += `Дата: ${data.time}\n`;
  text += `Статус: ${data.status || 'Неизвестно'}\n\n`;

  text += '--- API-МОДУЛИ ---\n';
  if (data.modules.length === 0) {
    text += '⏳ Запустите диагностику для получения данных\n';
  } else {
    for (const m of data.modules) {
      text += `${m.status === 'ONLINE' ? '🟢' : m.status === 'ERROR' ? '🟡' : m.status === 'OFFLINE' ? '🔴' : '⚪'} ${m.name}: ${m.status} (${m.time})\n`;
    }
  }

  text += '\n--- СИСТЕМА ---\n';
  if (Object.keys(data.system).length === 0) {
    text += '⏳ Данные не загружены\n';
  } else {
    for (const [key, value] of Object.entries(data.system)) {
      text += `${key}: ${value}\n`;
    }
  }

  text += '\n--- ЦЕЛОСТНОСТЬ ДАННЫХ ---\n';
  if (Object.keys(data.integrity).length === 0) {
    text += '⏳ Данные не загружены\n';
  } else {
    for (const [key, value] of Object.entries(data.integrity)) {
      text += `${key}: ${value}\n`;
    }
  }

  text += '\n--- AI-АНАЛИЗ ЛОГОВ ---\n';
  if (data.aiAnalysis.summary || data.aiAnalysis.issues?.length > 0) {
    if (data.aiAnalysis.summary) text += `Вывод: ${data.aiAnalysis.summary}\n`;
    if (data.aiAnalysis.issues?.length > 0) {
      text += 'Проблемы:\n';
      for (const issue of data.aiAnalysis.issues) {
        text += `  - ${issue}\n`;
      }
    }
    if (data.aiAnalysis.recommendations?.length > 0) {
      text += 'Рекомендации:\n';
      for (const rec of data.aiAnalysis.recommendations) {
        text += `  - ${rec}\n`;
      }
    }
  } else {
    text += '⏳ AI-анализ не выполнен\n';
  }

  text += '\n--- СТРАНИЦЫ ---\n';
  if (data.pages.length === 0) {
    text += '⏳ Запустите диагностику для получения данных\n';
  } else {
    for (const p of data.pages) {
      text += `${p.status === 'ONLINE' ? '🟢' : p.status === 'ERROR' ? '🟡' : p.status === 'OFFLINE' ? '🔴' : '⚪'} ${p.path}: ${p.status} (${p.time})\n`;
    }
  }

  text += '\n--- CRUCIX OSINT TERMINAL ---\n';
  text += '🌐 http://localhost:3117/diagnostics\n';
  return text;
}

// ============================================================
// 5. ЗАГРУЗКА ПОСЛЕДНЕГО ОТЧЁТА
// ============================================================
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

// ============================================================
// 6. ЗАПУСК ДИАГНОСТИКИ
// ============================================================
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
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

// ============================================================
// 7. РЕНДЕРИНГ ОТЧЁТА
// ============================================================
function renderReport(report) {
  // Общий статус
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

  // Статистика
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

  renderModules(report.modules);
  renderMetrics(report.system);
  renderIntegrity(report.dataIntegrity);
  renderAIAnalysis(report.aiLogAnalysis);
  renderPages(report.pages);
}

function renderModules(modules) {
  const container = document.getElementById('modules-grid');
  if (!modules || modules.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = '';
  for (const m of modules) {
    const statusClass = m.status === 'ONLINE' ? 'online' : m.status === 'ERROR' ? 'error' : 'offline';
    const time = m.responseTime !== null ? `${m.responseTime}ms` : '—';
    html += `
      <div class="module-item-d">
        <span>${m.id}</span>
        <span>
          <span class="status ${statusClass}">${m.status}</span>
          <span class="time">${time}</span>
        </span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderMetrics(system) {
  const container = document.getElementById('metrics-grid');
  if (!system) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  container.innerHTML = `
    <div class="metric-card"><div class="label">Память</div><div class="value">${system.memory?.used || '—'}</div></div>
    <div class="metric-card"><div class="label">CPU (1/5/15)</div><div class="value">${system.cpu?.loadAverage?.join(' / ') || '—'}</div></div>
    <div class="metric-card"><div class="label">Аптайм</div><div class="value">${system.uptime?.process || '—'}</div></div>
    <div class="metric-card"><div class="label">Платформа</div><div class="value">${system.platform || '—'}</div></div>
  `;
}

function renderIntegrity(integrity) {
  const container = document.getElementById('integrity-grid');
  if (!integrity) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = '';
  for (const [key, val] of Object.entries(integrity)) {
    const cls = val.status === 'OK' ? 'ok' : val.status === 'ERROR' ? 'error' : 'warning';
    const info = val.files || val.entries || val.size || val.error || '—';
    html += `
      <div class="integrity-item">
        <span>${key}</span>
        <span class="${cls}">${val.status} (${info})</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderAIAnalysis(ai) {
  const container = document.getElementById('ai-analysis');
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

  const cls = ai.status === 'STABLE' ? 'stable' : ai.status === 'WARNING' ? 'warning' : 'critical';
  const label = ai.status === 'STABLE' ? '🟢 Стабильно' : ai.status === 'WARNING' ? '🟡 Есть предупреждения' : '🔴 Критические проблемы';

  let html = `<div class="${cls}" style="font-weight:600;font-size:16px;">${label}</div>`;
  html += `<div class="summary">${ai.summary || '—'}</div>`;

  if (ai.issues && ai.issues.length > 0) {
    html += `<ul class="issues">${ai.issues.map(i => `<li>⚠️ ${i}</li>`).join('')}</ul>`;
  }

  if (ai.recommendations && ai.recommendations.length > 0) {
    html += `<ul class="recommendations">${ai.recommendations.map(r => `<li>✅ ${r}</li>`).join('')}</ul>`;
  }

  container.innerHTML = html;
}

function renderPages(pages) {
  const container = document.getElementById('pages-grid');
  if (!pages || pages.length === 0) {
    container.innerHTML = '<div class="empty">Нет данных</div>';
    return;
  }

  let html = '';
  for (const p of pages) {
    const statusClass = p.status === 'ONLINE' ? 'online' : p.status === 'ERROR' ? 'error' : 'offline';
    const time = p.responseTime !== null ? `${p.responseTime}ms` : '—';
    html += `
      <div class="module-item-d">
        <span>${p.path}</span>
        <span>
          <span class="status ${statusClass}">${p.status}</span>
          <span class="time">${time}</span>
        </span>
      </div>
    `;
  }
  container.innerHTML = html;
}

// ============================================================
// 8. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-run').addEventListener('click', runDiagnostics);
  document.getElementById('btn-refresh').addEventListener('click', loadLatest);

  loadLatest().then(found => {
    if (!found) {
      document.getElementById('modules-grid').innerHTML = '<div class="empty">Запустите диагностику</div>';
      document.getElementById('pages-grid').innerHTML = '<div class="empty">Запустите диагностику</div>';
    }
  });
});
