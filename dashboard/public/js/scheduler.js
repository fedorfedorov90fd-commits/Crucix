// ============================================================
// ПЛАНИРОВЩИК ЗАДАЧ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let currentTasks = [];
let runningTasks = new Set();
let schedulerRunning = false;

// ============================================================
// 1. ВРЕМЯ В ВЕРХНЕЙ ПАНЕЛИ
// ============================================================
function updateTopbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  document.getElementById('topbar-date').textContent = `${dateStr} ${timeStr}`;
}
updateTopbar();
setInterval(updateTopbar, 60000);

// ============================================================
// 2. ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
// ============================================================
let currentLang = localStorage.getItem('crucix-lang') || 'ru';

function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('crucix-lang', lang);
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  showNotification(`🌐 Язык: ${lang.toUpperCase()}`);
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.lang === currentLang);
});

// ============================================================
// 3. КНОПКА КОПИРОВАНИЯ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  copyPageData();
});

function copyPageData() {
  const data = collectPageData();
  const text = formatDataForCopy(data);

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
}

function collectPageData() {
  const data = {
    title: document.title,
    time: new Date().toLocaleString(),
    stats: {},
    tasks: []
  };

  document.querySelectorAll('.stat-item').forEach(item => {
    const label = item.querySelector('.stat-label')?.textContent || '—';
    const value = item.querySelector('.stat-value')?.textContent || '—';
    data.stats[label] = value;
  });

  document.querySelectorAll('.task-item').forEach(item => {
    const name = item.querySelector('.col-name .task-name')?.textContent || '—';
    const status = item.querySelector('.col-status')?.textContent?.trim() || '—';
    const lastRun = item.querySelector('.col-last')?.textContent?.trim() || '—';
    data.tasks.push({ name, status, lastRun });
  });

  return data;
}

function formatDataForCopy(data) {
  let text = `=== ${data.title} ===\n`;
  text += `Дата: ${data.time}\n\n`;
  text += '--- СТАТИСТИКА ---\n';
  for (const [key, value] of Object.entries(data.stats)) {
    text += `${key}: ${value}\n`;
  }
  text += '\n--- ЗАДАЧИ ---\n';
  for (const task of data.tasks) {
    text += `${task.name} | ${task.status} | ${task.lastRun}\n`;
  }
  return text;
}

// ============================================================
// 4. КООРДИНАТНАЯ СЕТКА
// ============================================================
let gridVisible = false;
const gridEl = document.getElementById('coordinate-grid');
const coordsEl = document.getElementById('grid-coords');
const gridBtn = document.getElementById('grid-toggle');

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    toggleGrid();
  }
});

gridBtn.addEventListener('click', toggleGrid);

function toggleGrid() {
  gridVisible = !gridVisible;
  gridEl.classList.toggle('visible', gridVisible);
  coordsEl.classList.toggle('visible', gridVisible);
  gridBtn.classList.toggle('active', gridVisible);

  if (gridVisible) {
    showNotification('⊞ Сетка включена');
    document.addEventListener('mousemove', updateCoords);
  } else {
    showNotification('⊞ Сетка выключена');
    document.removeEventListener('mousemove', updateCoords);
  }
}

function updateCoords(e) {
  coordsEl.textContent = `X: ${e.clientX}  Y: ${e.clientY}`;
}

// ============================================================
// 5. УВЕДОМЛЕНИЯ
// ============================================================
function showNotification(msg) {
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ============================================================
// 6. ЗАГРУЗКА ДАННЫХ
// ============================================================
async function loadTasks() {
  try {
    const response = await fetch('/api/scheduler/tasks');
    const data = await response.json();

    if (data.success) {
      currentTasks = data.tasks;
      renderTasks(data.tasks);
      renderStats(data.stats);
      updateRunningTasks(data.running || []);
    } else {
      showError('Ошибка загрузки задач');
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка:', e);
    showError('Ошибка подключения к серверу');
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('tasks-list');

  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div class="empty">Нет задач</div>';
    return;
  }

  let html = '';
  for (const task of tasks) {
    const isRunning = runningTasks.has(task.id);
    const statusClass = isRunning ? 'status-running' :
                       task.enabled ? 'status-enabled' : 'status-disabled';
    const statusText = isRunning ? '⏳ Выполняется' :
                      task.enabled ? '✅ Вкл' : '⛔ Выкл';

    const lastRun = task.lastRun ?
      new Date(task.lastRun).toLocaleString('ru-RU') : 'Никогда';

    const lastStatus = task.lastStatus === 'success' ? '✅ Успешно' :
                      task.lastStatus === 'error' ? '❌ Ошибка' : '—';

    const icon = task.id === 'rss-update' ? '📡' :
                task.id === 'collect-feeds' ? '📰' :
                task.id === 'ai-analyze-news' ? '🧠' :
                task.id === 'update-global-index' ? '📊' :
                task.id === 'collect-newsapi' ? '🌐' :
                task.id === 'cleanup-old-data' ? '🧹' : '⚙️';

    html += `
      <div class="task-item" data-id="${task.id}">
        <span class="col-name">
          <span class="task-icon">${icon}</span>
          <span class="task-name">${task.name}</span>
        </span>
        <span class="col-description">${task.description || '—'}</span>
        <span class="col-schedule">${task.schedule || '—'}</span>
        <span class="col-status ${statusClass}">${statusText}</span>
        <span class="col-last">
          ${lastRun}
          <br><small style="color:#555;">${lastStatus}</small>
        </span>
        <span class="col-actions">
          <button class="btn-toggle ${task.enabled ? 'active' : 'inactive'}"
                  onclick="toggleTask('${task.id}')"
                  title="${task.enabled ? 'Выключить' : 'Включить'}">
            ${task.enabled ? '🟢' : '🔴'}
          </button>
          <button class="btn-run" onclick="runTask('${task.id}')"
                  ${isRunning ? 'disabled' : ''}
                  title="Запустить">
            ${isRunning ? '<span class="task-running-spinner"></span>' : '▶'}
          </button>
          <button class="btn-log" onclick="showLog('${task.id}')"
                  ${task.lastLog ? '' : 'disabled'}
                  title="Показать лог">
            📋
          </button>
        </span>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-enabled').textContent = stats.enabled || 0;
  document.getElementById('stat-running').textContent = stats.running || 0;
  document.getElementById('stat-success').textContent = stats.success || 0;
  document.getElementById('stat-error').textContent = stats.error || 0;
}

function updateRunningTasks(running) {
  runningTasks = new Set(running);
}

function showError(msg) {
  document.getElementById('tasks-list').innerHTML = `<div class="error">${msg}</div>`;
}

// ============================================================
// 7. ДЕЙСТВИЯ С ЗАДАЧАМИ
// ============================================================
async function toggleTask(id) {
  try {
    const response = await fetch(`/api/scheduler/tasks/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      await loadTasks();
      showNotification(`Задача ${data.task.enabled ? 'включена' : 'выключена'}`);
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка toggle:', e);
    showNotification('❌ Ошибка переключения задачи');
  }
}

async function runTask(id) {
  try {
    showNotification(`⏳ Запуск задачи...`);
    const response = await fetch(`/api/scheduler/tasks/${id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      await loadTasks();
      showNotification(`✅ Задача завершена за ${(data.result.duration / 1000).toFixed(1)}с`);
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка run:', e);
    showNotification('❌ Ошибка запуска задачи');
  }
}

async function runAllTasks() {
  try {
    showNotification('⏳ Запуск всех задач...');
    const response = await fetch('/api/scheduler/run-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      await loadTasks();
      const success = data.results.filter(r => r.success).length;
      const fail = data.results.length - success;
      showNotification(`✅ Запущено: ${success} успешно, ${fail} с ошибками`);
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка run-all:', e);
    showNotification('❌ Ошибка запуска всех задач');
  }
}

// ============================================================
// 8. ЛОГИ
// ============================================================
async function showLog(id) {
  try {
    const response = await fetch(`/api/scheduler/logs/${id}`);
    if (!response.ok) {
      showNotification('❌ Лог не найден');
      return;
    }
    const text = await response.text();

    // Создаём модальное окно
    let modal = document.getElementById('log-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'log-modal';
      modal.className = 'log-modal';
      modal.innerHTML = `
        <div class="log-modal-content">
          <div class="log-modal-header">
            <h3>📋 Лог: ${id}</h3>
            <button class="btn-close" onclick="closeLog()">×</button>
          </div>
          <div class="log-modal-body" id="log-modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    document.getElementById('log-modal-body').textContent = text;
    modal.classList.add('visible');
  } catch (e) {
    console.error('[Scheduler] Ошибка лога:', e);
    showNotification('❌ Ошибка загрузки лога');
  }
}

function closeLog() {
  const modal = document.getElementById('log-modal');
  if (modal) modal.classList.remove('visible');
}

// Закрытие по клику вне окна
document.addEventListener('click', function(e) {
  const modal = document.getElementById('log-modal');
  if (modal && modal.classList.contains('visible')) {
    if (e.target === modal) {
      closeLog();
    }
  }
});

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeLog();
  }
});

// ============================================================
// 9. УПРАВЛЕНИЕ ПЛАНИРОВЩИКОМ
// ============================================================
async function startScheduler() {
  try {
    const response = await fetch('/api/scheduler/start', { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      schedulerRunning = true;
      updateSchedulerStatus();
      showNotification('✅ Планировщик запущен');
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка старта:', e);
    showNotification('❌ Ошибка запуска планировщика');
  }
}

async function stopScheduler() {
  try {
    const response = await fetch('/api/scheduler/stop', { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      schedulerRunning = false;
      updateSchedulerStatus();
      showNotification('⏹ Планировщик остановлен');
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка остановки:', e);
    showNotification('❌ Ошибка остановки планировщика');
  }
}

async function checkSchedulerStatus() {
  try {
    const response = await fetch('/api/scheduler/status');
    const data = await response.json();
    if (data.success) {
      schedulerRunning = data.running;
      updateSchedulerStatus();
    }
  } catch (e) {
    console.error('[Scheduler] Ошибка статуса:', e);
  }
}

function updateSchedulerStatus() {
  const el = document.getElementById('scheduler-status');
  if (schedulerRunning) {
    el.textContent = '▶ Планировщик запущен';
    el.className = 'scheduler-status running';
  } else {
    el.textContent = '⏹ Планировщик остановлен';
    el.className = 'scheduler-status stopped';
  }
}

// ============================================================
// 10. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  // Кнопки
  document.getElementById('btn-refresh').addEventListener('click', loadTasks);
  document.getElementById('btn-run-all').addEventListener('click', runAllTasks);
  document.getElementById('btn-start-scheduler').addEventListener('click', startScheduler);
  document.getElementById('btn-stop-scheduler').addEventListener('click', stopScheduler);

  // Загрузка данных
  loadTasks();
  checkSchedulerStatus();

  // Автообновление каждые 30 секунд
  setInterval(() => {
    loadTasks();
    checkSchedulerStatus();
  }, 30000);
});