// ============================================================
// ДОВЕРИЕ К ИСТОЧНИКАМ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let currentSources = [];
let currentCategories = [];
let currentFilter = 'all';
let filterEnabled = true;

// ============================================================
// 1. ВРЕМЯ В ВЕРХНЕЙ ПАНЕЛИ
// ============================================================
function updateTopbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
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
    sources: []
  };
  document.querySelectorAll('.stat-item').forEach(item => {
    const label = item.querySelector('.stat-label')?.textContent || '—';
    const value = item.querySelector('.stat-value')?.textContent || '—';
    data.stats[label] = value;
  });
  document.querySelectorAll('.source-item').forEach(item => {
    const name = item.querySelector('.col-name')?.textContent?.trim() || '—';
    const category = item.querySelector('.col-category')?.textContent?.trim() || '—';
    const trust = item.querySelector('.col-trust')?.textContent?.trim() || '—';
    data.sources.push({ name, category, trust });
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
  text += '\n--- ИСТОЧНИКИ ---\n';
  for (const s of data.sources) {
    text += `${s.name} | ${s.category} | Рейтинг: ${s.trust}\n`;
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
async function loadSources() {
  try {
    const response = await fetch('/api/trust/sources');
    const data = await response.json();
    if (data.success) {
      currentSources = data.sources;
      currentCategories = data.categories || [];
      renderStats(data.stats);
      renderCategories(data.categories);
      renderSources(data.sources);
    } else {
      showError('Ошибка загрузки источников');
    }
  } catch (e) {
    console.error('[Trust] Ошибка:', e);
    showError('Ошибка подключения к серверу');
  }
}

function renderStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-enabled').textContent = stats.enabled || 0;
  document.getElementById('stat-avg').textContent = stats.avgTrust || 0;
  document.getElementById('stat-high').textContent = stats.high || 0;
  document.getElementById('stat-medium').textContent = stats.medium || 0;
  document.getElementById('stat-low').textContent = stats.low || 0;
}

function renderCategories(categories) {
  const select = document.getElementById('filter-category');
  select.innerHTML = '<option value="all">Все категории</option>';
  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  }
}

function renderSources(sources) {
  const container = document.getElementById('sources-list');
  
  let filtered = sources;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(s => s.category === currentFilter);
  }
  if (filterEnabled) {
    filtered = filtered.filter(s => s.enabled);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">Нет источников</div>';
    return;
  }

  let html = '';
  for (const s of filtered) {
    const trustClass = s.trust >= 80 ? 'high' : s.trust >= 60 ? 'medium' : 'low';
    const statusDot = s.enabled ? 'on' : 'off';
    const toggleText = s.enabled ? '🟢' : '🔴';
    const toggleClass = s.enabled ? 'on' : 'off';

    const credFill = s.credibility >= 80 ? 'fill-high' : s.credibility >= 60 ? 'fill-medium' : 'fill-low';
    const speedFill = s.speed >= 80 ? 'fill-high' : s.speed >= 60 ? 'fill-medium' : 'fill-low';
    const objFill = s.objectivity >= 80 ? 'fill-high' : s.objectivity >= 60 ? 'fill-medium' : 'fill-low';
    const authFill = s.authority >= 80 ? 'fill-high' : s.authority >= 60 ? 'fill-medium' : 'fill-low';
    const accFill = s.accuracy >= 80 ? 'fill-high' : s.accuracy >= 60 ? 'fill-medium' : 'fill-low';

    html += `
      <div class="source-item" data-id="${s.id}">
        <span class="col-status">
          <span class="status-dot ${statusDot}"></span>
        </span>
        <span class="col-name" title="${s.name}">${s.name}</span>
        <span class="col-category">${s.category || '—'}</span>
        <span class="col-trust ${trustClass}">${s.trust}</span>
        <span class="col-credibility">
          ${s.credibility}
          <span class="bar"><span class="fill ${credFill}" style="width:${s.credibility}%;"></span></span>
        </span>
        <span class="col-speed">
          ${s.speed}
          <span class="bar"><span class="fill ${speedFill}" style="width:${s.speed}%;"></span></span>
        </span>
        <span class="col-objectivity">
          ${s.objectivity}
          <span class="bar"><span class="fill ${objFill}" style="width:${s.objectivity}%;"></span></span>
        </span>
        <span class="col-authority">
          ${s.authority}
          <span class="bar"><span class="fill ${authFill}" style="width:${s.authority}%;"></span></span>
        </span>
        <span class="col-accuracy">
          ${s.accuracy}
          <span class="bar"><span class="fill ${accFill}" style="width:${s.accuracy}%;"></span></span>
        </span>
        <span class="col-actions">
          <button class="btn-toggle ${toggleClass}" onclick="toggleSource('${s.id}')" title="${s.enabled ? 'Выключить' : 'Включить'}">
            ${toggleText}
          </button>
          <button class="btn-edit" onclick="editSource('${s.id}')" title="Редактировать">✏️</button>
        </span>
      </div>
    `;
  }

  container.innerHTML = html;
}

function showError(msg) {
  document.getElementById('sources-list').innerHTML = `<div class="error">${msg}</div>`;
}

// ============================================================
// 7. ДЕЙСТВИЯ С ИСТОЧНИКАМИ
// ============================================================
async function toggleSource(id) {
  try {
    const response = await fetch(`/api/trust/toggle/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      await loadSources();
      showNotification(`Источник ${data.source.enabled ? 'включён' : 'выключен'}`);
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Trust] Ошибка toggle:', e);
    showNotification('❌ Ошибка переключения');
  }
}

// ============================================================
// 8. РЕДАКТИРОВАНИЕ ИСТОЧНИКА
// ============================================================
let editingId = null;

function editSource(id) {
  const source = currentSources.find(s => s.id === id);
  if (!source) return;

  editingId = id;
  const modal = document.getElementById('edit-modal') || createEditModal();
  
  document.getElementById('edit-name').value = source.name;
  document.getElementById('edit-category').value = source.category || '';
  document.getElementById('edit-trust').value = source.trust;
  document.getElementById('edit-trust-val').textContent = source.trust;
  document.getElementById('edit-credibility').value = source.credibility;
  document.getElementById('edit-credibility-val').textContent = source.credibility;
  document.getElementById('edit-speed').value = source.speed;
  document.getElementById('edit-speed-val').textContent = source.speed;
  document.getElementById('edit-objectivity').value = source.objectivity;
  document.getElementById('edit-objectivity-val').textContent = source.objectivity;
  document.getElementById('edit-authority').value = source.authority;
  document.getElementById('edit-authority-val').textContent = source.authority;
  document.getElementById('edit-accuracy').value = source.accuracy;
  document.getElementById('edit-accuracy-val').textContent = source.accuracy;
  document.getElementById('edit-notes').value = source.notes || '';

  modal.classList.add('visible');
}

function createEditModal() {
  const modal = document.createElement('div');
  modal.id = 'edit-modal';
  modal.className = 'edit-modal';
  modal.innerHTML = `
    <div class="edit-modal-content">
      <div class="edit-modal-header">
        <h3>✏️ Редактирование источника</h3>
        <button class="btn-close" onclick="closeEdit()">×</button>
      </div>
      <div class="edit-modal-body">
        <div class="form-group">
          <label>Название</label>
          <input type="text" id="edit-name" placeholder="Название источника">
        </div>
        <div class="form-group">
          <label>Категория</label>
          <input type="text" id="edit-category" placeholder="Категория">
        </div>
        <div class="form-group">
          <label>Общий рейтинг: <span id="edit-trust-val">0</span></label>
          <div class="range-row">
            <input type="range" id="edit-trust" min="0" max="100" value="50">
          </div>
        </div>
        <div class="form-group">
          <label>Достоверность: <span id="edit-credibility-val">0</span></label>
          <div class="range-row">
            <input type="range" id="edit-credibility" min="0" max="100" value="50">
          </div>
        </div>
        <div class="form-group">
          <label>Оперативность: <span id="edit-speed-val">0</span></label>
          <div class="range-row">
            <input type="range" id="edit-speed" min="0" max="100" value="50">
          </div>
        </div>
        <div class="form-group">
          <label>Объективность: <span id="edit-objectivity-val">0</span></label>
          <div class="range-row">
            <input type="range" id="edit-objectivity" min="0" max="100" value="50">
          </div>
        </div>
        <div class="form-group">
          <label>Авторитетность: <span id="edit-authority-val">0</span></label>
          <div class="range-row">
            <input type="range" id="edit-authority" min="0" max="100" value="50">
          </div>
        </div>
        <div class="form-group">
          <label>Точность: <span id="edit-accuracy-val">0</span></label>
          <div class="range-row">
            <input type="range" id="edit-accuracy" min="0" max="100" value="50">
          </div>
        </div>
        <div class="form-group">
          <label>Примечания</label>
          <textarea id="edit-notes" rows="2" placeholder="Примечания"></textarea>
        </div>
      </div>
      <div class="edit-modal-footer">
        <button class="btn btn-cancel" onclick="closeEdit()">Отмена</button>
        <button class="btn btn-save" onclick="saveEdit()">Сохранить</button>
      </div>
    </div>
  `;

  // Связываем слайдеры с отображением
  modal.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', function() {
      const valSpan = document.getElementById(this.id + '-val');
      if (valSpan) valSpan.textContent = this.value;
    });
  });

  document.body.appendChild(modal);
  return modal;
}

function closeEdit() {
  const modal = document.getElementById('edit-modal');
  if (modal) modal.classList.remove('visible');
  editingId = null;
}

async function saveEdit() {
  if (!editingId) return;

  const updates = {
    name: document.getElementById('edit-name').value.trim(),
    category: document.getElementById('edit-category').value.trim(),
    trust: parseInt(document.getElementById('edit-trust').value),
    credibility: parseInt(document.getElementById('edit-credibility').value),
    speed: parseInt(document.getElementById('edit-speed').value),
    objectivity: parseInt(document.getElementById('edit-objectivity').value),
    authority: parseInt(document.getElementById('edit-authority').value),
    accuracy: parseInt(document.getElementById('edit-accuracy').value),
    notes: document.getElementById('edit-notes').value.trim()
  };

  try {
    const response = await fetch(`/api/trust/source/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await response.json();
    if (data.success) {
      closeEdit();
      await loadSources();
      showNotification('✅ Источник обновлён');
    } else {
      showNotification('❌ Ошибка: ' + data.error);
    }
  } catch (e) {
    console.error('[Trust] Ошибка сохранения:', e);
    showNotification('❌ Ошибка сохранения');
  }
}

// Закрытие по клику вне окна
document.addEventListener('click', function(e) {
  const modal = document.getElementById('edit-modal');
  if (modal && modal.classList.contains('visible')) {
    if (e.target === modal) {
      closeEdit();
    }
  }
});

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeEdit();
  }
});

// ============================================================
// 9. ФИЛЬТРЫ
// ============================================================
document.getElementById('filter-category').addEventListener('change', function() {
  currentFilter = this.value;
  renderSources(currentSources);
});

document.getElementById('filter-enabled').addEventListener('change', function() {
  filterEnabled = this.checked;
  renderSources(currentSources);
});

// ============================================================
// 10. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-refresh').addEventListener('click', loadSources);
  loadSources();
});