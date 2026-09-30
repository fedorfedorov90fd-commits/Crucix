// ============================================================
// TRUST.JS — клиентская логика модуля доверия
// ============================================================

let currentFilter = 'all';
let sourcesData = [];

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
// 2. ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
// ============================================================
let currentLang = localStorage.getItem('crucix-lang') || 'ru';
function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('crucix-lang', lang);
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
  showNotification(`🌐 Язык: ${lang.toUpperCase()}`);
}
document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === currentLang));

// ============================================================
// 3. КОПИРОВАНИЕ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  const data = collectPageData();
  const text = formatDataForCopy(data);
  navigator.clipboard.writeText(text).then(() => showNotification('✅ Данные скопированы')).catch(() => {
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
  const data = { title: document.title, time: new Date().toLocaleString(), sources: [] };
  document.querySelectorAll('.source-item').forEach(item => {
    const name = item.querySelector('.col-name')?.textContent || '—';
    const overall = item.querySelector('.col-overall')?.textContent || '—';
    const level = item.querySelector('.col-level .trust-badge')?.textContent || '—';
    data.sources.push({ name, overall, level });
  });
  return data;
}

function formatDataForCopy(data) {
  let text = `=== ${data.title} ===\nДата: ${data.time}\n\n--- ИСТОЧНИКИ ---\n`;
  for (const s of data.sources) {
    text += `  ${s.name} | Рейтинг: ${s.overall} | Доверие: ${s.level}\n`;
  }
  return text;
}

// ============================================================
// 4. КООРДИНАТНАЯ СЕТКА
// ============================================================
let gridVisible = false;
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); toggleGrid(); }
});
document.getElementById('grid-toggle').addEventListener('click', toggleGrid);

function toggleGrid() {
  gridVisible = !gridVisible;
  document.getElementById('coordinate-grid').classList.toggle('visible', gridVisible);
  document.getElementById('grid-coords').classList.toggle('visible', gridVisible);
  document.getElementById('grid-toggle').classList.toggle('active', gridVisible);
  showNotification(gridVisible ? '⊞ Сетка включена' : '⊞ Сетка выключена');
  if (gridVisible) {
    document.addEventListener('mousemove', e => {
      document.getElementById('grid-coords').textContent = `X: ${e.clientX}  Y: ${e.clientY}`;
    });
  } else {
    document.removeEventListener('mousemove', () => {});
  }
}

// ============================================================
// 5. УВЕДОМЛЕНИЯ
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
// 6. ЗАГРУЗКА ДАННЫХ
// ============================================================
async function loadData() {
  try {
    const response = await fetch('/api/trust/sources');
    const data = await response.json();
    if (data.success) {
      sourcesData = data.sources;
      renderStats(data.sources);
      renderSources(data.sources);
      updateTrustStatus();
    } else {
      showError('Ошибка загрузки данных');
    }
  } catch (e) {
    console.error('[Trust] Ошибка:', e);
    showError('Ошибка подключения к серверу');
  }
}

function renderStats(sources) {
  const total = sources.length;
  const high = sources.filter(s => s.level === 'HIGH').length;
  const medium = sources.filter(s => s.level === 'MEDIUM').length;
  const low = sources.filter(s => s.level === 'LOW').length;
  const veryLow = sources.filter(s => s.level === 'VERY_LOW').length;
  const avg = sources.reduce((sum, s) => sum + s.overall, 0) / total;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-avg').textContent = avg.toFixed(1);
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-medium').textContent = medium;
  document.getElementById('stat-low').textContent = low;
  document.getElementById('stat-verylow').textContent = veryLow;
}

function renderSources(sources) {
  const container = document.getElementById('sources-list');
  let filtered = sources;
  if (currentFilter !== 'all') {
    if (['HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'].includes(currentFilter)) {
      filtered = sources.filter(s => s.level === currentFilter);
    } else {
      filtered = sources.filter(s => s.status === currentFilter);
    }
  }
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">Нет источников с таким фильтром</div>';
    return;
  }
  let html = '';
  for (const s of filtered) {
    html += `
      <div class="source-item">
        <span class="col-name" title="${s.name}">${s.name}</span>
        <span class="col-type">${s.type || '—'}</span>
        <span class="col-country">${s.country || '—'}</span>
        <span class="col-status status-${s.status || 'unknown'}">${s.status || '—'}</span>
        <span class="col-ratings">${s.ratings?.credibility || 5}</span>
        <span class="col-ratings">${s.ratings?.speed || 5}</span>
        <span class="col-ratings">${s.ratings?.objectivity || 5}</span>
        <span class="col-ratings">${s.ratings?.relevance || 5}</span>
        <span class="col-ratings">${s.ratings?.accuracy || 5}</span>
        <span class="col-overall">${s.overall}</span>
        <span class="col-level"><span class="trust-badge ${s.level}">${s.label}</span></span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateTrustStatus() {
  document.getElementById('trust-status').textContent = `🔄 Последнее обновление: ${new Date().toLocaleString()}`;
}

function showError(msg) {
  document.getElementById('sources-list').innerHTML = `<div class="error">${msg}</div>`;
}

// ============================================================
// 7. ФИЛЬТРЫ
// ============================================================
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderSources(sourcesData);
  });
});

// ============================================================
// 8. ОБНОВЛЕНИЕ РЕЙТИНГОВ
// ============================================================
document.getElementById('btn-update').addEventListener('click', async () => {
  const btn = document.getElementById('btn-update');
  btn.textContent = '⏳ Обновление...';
  btn.disabled = true;
  try {
    const response = await fetch('/api/trust/update', { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      showNotification(`✅ Обновлено ${data.updated} источников`);
      await loadData();
    } else {
      showNotification('❌ Ошибка обновления');
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🔄 Обновить рейтинги';
    btn.disabled = false;
  }
});

document.getElementById('btn-refresh').addEventListener('click', loadData);

// ============================================================
// 9. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', loadData);
