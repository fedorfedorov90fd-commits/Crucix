// ============================================================
// ЦЕНТР МОНИТОРИНГА — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let monitorRunning = false;
let monitorInterval = null;
let eventLog = [];
let checkCount = 0;
let errorCount = 0;
let startTime = null;

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
// 4. КОПИРОВАНИЕ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  const text = collectPageData();
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

function collectPageData() {
  let text = `=== CRUCIX — ЦЕНТР МОНИТОРИНГА ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n`;
  text += `Активная вкладка: ${document.querySelector('.tab-btn.active')?.textContent || '—'}\n\n`;

  const status = document.getElementById('monitor-status');
  text += `Фоновый мониторинг: ${status?.textContent || '—'}\n`;
  text += `Проверок: ${document.getElementById('stat-checks')?.textContent || '0'}\n`;
  text += `Ошибок: ${document.getElementById('stat-errors')?.textContent || '0'}\n`;
  text += `Модулей онлайн: ${document.getElementById('stat-online')?.textContent || '0'}\n\n`;

  text += '--- ПОСЛЕДНИЕ СОБЫТИЯ ---\n';
  const events = document.querySelectorAll('.event-item');
  events.forEach(el => {
    const time = el.querySelector('.time')?.textContent || '';
    const msg = el.textContent.replace(time, '').trim();
    text += `${time} ${msg}\n`;
  });

  text += '\n--- CRUCIX OSINT TERMINAL ---\n';
  text += '🌐 http://localhost:3117/monitor\n';
  return text;
}

// ============================================================
// 5. ВКЛАДКИ
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('tab-' + this.dataset.tab).classList.add('active');

    // Если переключились на вкладку диагностики — обновляем iframe
    if (this.dataset.tab === 'diagnostics') {
      const frame = document.getElementById('diagnostics-frame');
      if (frame) frame.src = frame.src;
    }
  });
});

// ============================================================
// 6. ФОНОВЫЙ МОНИТОРИНГ
// ============================================================
async function checkModules() {
  try {
    const response = await fetch('/api/monitor/check');
    const data = await response.json();
    if (data.success) {
      const hasError = data.modules.some(m => m.status === 'ERROR' || m.status === 'OFFLINE');
      const timestamp = new Date().toLocaleTimeString();

      let statusClass = hasError ? 'error' : 'ok';
      let statusText = hasError ? '🔴 Обнаружены ошибки!' : '✅ Все модули работают';

      addEvent(timestamp, statusText, statusClass);

      // Обновляем статистику
      const total = data.modules.length;
      const online = data.modules.filter(m => m.status === 'ONLINE').length;
      document.getElementById('stat-online').textContent = online + '/' + total;

      checkCount++;
      document.getElementById('stat-checks').textContent = checkCount;

      if (hasError) {
        errorCount++;
        document.getElementById('stat-errors').textContent = errorCount;
      }

      // Обновляем время последней проверки
      document.getElementById('last-check').textContent = `Последняя проверка: ${timestamp}`;
    }
  } catch (e) {
    console.error('[Monitor] Ошибка проверки:', e);
    addEvent(new Date().toLocaleTimeString(), '❌ Ошибка подключения к серверу', 'error');
  }
}

function addEvent(time, message, type) {
  const container = document.getElementById('event-log');
  const entry = document.createElement('div');
  entry.className = 'event-item';
  entry.innerHTML = `<span class="time">${time}</span><span class="${type}">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  // Ограничиваем количество событий
  while (container.children.length > 100) {
    container.removeChild(container.firstChild);
  }
}

function startMonitor() {
  if (monitorRunning) return;

  const freq = parseInt(document.getElementById('frequency').value) * 1000;
  monitorRunning = true;
  startTime = Date.now();

  document.getElementById('monitor-status').textContent = '▶ ЗАПУЩЕН';
  document.getElementById('monitor-status').className = 'status-label running';
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-stop').disabled = false;

  addEvent(new Date().toLocaleTimeString(), '▶ Мониторинг запущен', 'info');

  // Первая проверка сразу
  checkModules();

  monitorInterval = setInterval(checkModules, freq);
}

function stopMonitor() {
  if (!monitorRunning) return;

  monitorRunning = false;
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }

  document.getElementById('monitor-status').textContent = '⏹ ОСТАНОВЛЕН';
  document.getElementById('monitor-status').className = 'status-label stopped';
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-stop').disabled = true;

  addEvent(new Date().toLocaleTimeString(), '⏹ Мониторинг остановлен', 'warning');
}

function clearLog() {
  const container = document.getElementById('event-log');
  container.innerHTML = '<div class="empty">⏳ Лог очищен</div>';
  checkCount = 0;
  errorCount = 0;
  document.getElementById('stat-checks').textContent = '0';
  document.getElementById('stat-errors').textContent = '0';
}

// Обработчики кнопок
document.getElementById('btn-start').addEventListener('click', startMonitor);
document.getElementById('btn-stop').addEventListener('click', stopMonitor);
document.getElementById('btn-check-now').addEventListener('click', checkModules);
document.getElementById('btn-clear-log').addEventListener('click', clearLog);

// Обновление статистики каждые 10 секунд
setInterval(() => {
  if (startTime) {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    document.getElementById('stat-uptime').textContent = `${h}ч ${m}м`;
  }
}, 10000);

// ============================================================
// 7. ИНВЕНТАРИЗАЦИЯ
// ============================================================
async function scanInventory() {
  const container = document.getElementById('inventory-list');
  container.innerHTML = '<div class="empty">⏳ Сканирование...</div>';

  try {
    const response = await fetch('/api/monitor/inventory');
    const data = await response.json();

    if (data.success) {
      let html = '';
      let online = 0, error = 0, offline = 0, unreg = 0;

      for (const m of data.modules) {
        let statusClass = 'status-online';
        let statusText = '✅ ONLINE';
        if (m.status === 'ERROR') { statusClass = 'status-error'; statusText = '🟡 ERROR'; error++; }
        else if (m.status === 'OFFLINE') { statusClass = 'status-offline'; statusText = '🔴 OFFLINE'; offline++; }
        else if (m.status === 'UNREGISTERED') { statusClass = 'status-unregistered'; statusText = '🟡 NOT CONFIGURED'; unreg++; }
        else { online++; }

        html += `
          <div class="inventory-item">
            <span class="name">${m.name}</span>
            <span>
              <span class="${statusClass}">${statusText}</span>
              <span class="time">${m.responseTime || '—'}</span>
            </span>
          </div>
        `;
      }

      container.innerHTML = html;
      document.getElementById('inventory-summary').textContent =
        `Загружено: ${data.modules.length} модулей | ✅ ${online} | 🟡 ${error+unreg} | 🔴 ${offline}`;
    }
  } catch (e) {
    container.innerHTML = `<div class="empty">❌ Ошибка: ${e.message}</div>`;
  }
}

document.getElementById('btn-scan').addEventListener('click', scanInventory);

// Фильтры инвентаризации
document.getElementById('btn-filter-all').addEventListener('click', () => {
  document.querySelectorAll('.inventory-item').forEach(el => el.style.display = 'flex');
});
document.getElementById('btn-filter-online').addEventListener('click', () => {
  document.querySelectorAll('.inventory-item').forEach(el => {
    el.style.display = el.textContent.includes('ONLINE') ? 'flex' : 'none';
  });
});
document.getElementById('btn-filter-error').addEventListener('click', () => {
  document.querySelectorAll('.inventory-item').forEach(el => {
    el.style.display = el.textContent.includes('ERROR') || el.textContent.includes('NOT CONFIGURED') ? 'flex' : 'none';
  });
});
document.getElementById('btn-filter-offline').addEventListener('click', () => {
  document.querySelectorAll('.inventory-item').forEach(el => {
    el.style.display = el.textContent.includes('OFFLINE') ? 'flex' : 'none';
  });
});

// ============================================================
// 8. ЭКСПОРТ ДЛЯ ИИ
// ============================================================
async function generateContext() {
  const container = document.getElementById('context-preview');
  container.innerHTML = '⏳ Генерация отчёта...';

  try {
    const response = await fetch('/api/monitor/export');
    const data = await response.json();

    if (data.success) {
      container.textContent = data.context;
      document.getElementById('export-info').textContent = `Последний экспорт: ${new Date().toLocaleString()}`;
    } else {
      container.textContent = '❌ Ошибка генерации: ' + (data.error || '—');
    }
  } catch (e) {
    container.textContent = '❌ Ошибка: ' + e.message;
  }
}

function copyContext() {
  const container = document.getElementById('context-preview');
  const text = container.textContent;

  if (!text || text.includes('Ошибка') || text.includes('⏳')) {
    showNotification('⚠️ Сначала сгенерируйте отчёт');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showNotification('✅ Отчёт скопирован в буфер обмена');
  }).catch(() => {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    showNotification('✅ Отчёт скопирован');
  });
}

function saveContext() {
  const container = document.getElementById('context-preview');
  const text = container.textContent;

  if (!text || text.includes('Ошибка') || text.includes('⏳')) {
    showNotification('⚠️ Сначала сгенерируйте отчёт');
    return;
  }

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crucix-context-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('✅ Файл сохранён');
}

document.getElementById('btn-generate').addEventListener('click', generateContext);
document.getElementById('btn-copy-context').addEventListener('click', copyContext);
document.getElementById('btn-save-context').addEventListener('click', saveContext);

// ============================================================
// 9. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  // Автоматически сканируем инвентаризацию при загрузке
  setTimeout(scanInventory, 500);
});
