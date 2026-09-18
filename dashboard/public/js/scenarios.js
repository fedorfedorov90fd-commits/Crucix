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
  label.textContent = '⏳ Генерация...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/scenarios/generate', { method: 'POST' });
    const data = await resp.json();

    if (data.success) {
      renderScenarios(data.scenarios);
      renderTree();
      loadRecommendations();
      loadStats();
      showNotification(`✅ Сгенерировано ${data.count} сценариев`);
    } else {
      showNotification('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    showNotification('❌ Ошибка: ' + e.message);
  } finally {
    btn.textContent = '🚀 Сгенерировать сценарии';
    btn.disabled = false;
    label.textContent = '⏹ Готов';
    label.className = 'status-label';
  }
}

function renderScenarios(scenarios) {
  const container = document.getElementById('scenarios-grid');

  if (!scenarios || scenarios.length === 0) {
    container.innerHTML = '<div class="empty">Нет сценариев</div>';
    return;
  }

  let html = '';
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const prob = (s.probability * 100).toFixed(0);
    const color = colors[i % colors.length];

    let impactsHtml = '';
    if (s.impacts && s.impacts.length > 0) {
      impactsHtml = '<div class="impacts">';
      for (const impact of s.impacts) {
        impactsHtml += `<span class="impact-tag">${impact.type}: ${impact.severity}%</span>`;
      }
      impactsHtml += '</div>';
    }

    html += `
      <div class="scenario-card" style="border-left-color: ${color}">
        <div class="header">
          <span class="icon">${s.icon || '🧠'}</span>
          <span class="prob">${prob}%</span>
        </div>
        <div class="name">${s.name || 'Сценарий'}</div>
        <div class="desc">${s.description || 'Нет описания'}</div>
        <span class="category">${s.category || 'general'}</span>
        <span class="confidence">Доверие: ${s.confidence || 0}%</span>
        ${impactsHtml}
        <div style="font-size:10px;color:#555;margin-top:4px;">Триггер: ${s.triggerEvent || '—'}</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

async function renderTree() {
  try {
    const resp = await fetch('/api/scenarios/tree');
    const data = await resp.json();
    const container = document.getElementById('tree-container');

    if (data.success && data.tree && data.tree.nodes && data.tree.nodes.length > 1) {
      let html = '<div style="padding:16px;font-size:13px;color:#c8d0d8;width:100%;">';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';

      const root = data.tree.nodes.find(n => n.id === 'root');
      if (root) {
        html += `<div style="background:#5bc0f8;padding:8px 16px;border-radius:6px;color:#0a0a0f;font-weight:600;margin-bottom:12px;width:100%;text-align:center;">${root.label}</div>`;
      }

      const children = data.tree.nodes.filter(n => n.id !== 'root');
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';
      for (const node of children) {
        const prob = (node.probability * 100).toFixed(0) || '?';
        html += `
          <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border-left:3px solid ${node.color || '#8b5cf6'};min-width:120px;">
            <div style="font-size:11px;color:#888;">${node.icon || '🧠'} ${node.label || '—'}</div>
            <div style="font-size:14px;font-weight:600;color:#ffd700;">${prob}%</div>
          </div>
        `;
      }
      html += '</div></div>';
      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="loading">🌳 Нет данных для дерева. Сгенерируйте сценарии.</div>';
    }
  } catch (e) {
    console.error('[Scenarios] Ошибка загрузки дерева:', e);
    document.getElementById('tree-container').innerHTML = '<div class="loading">❌ Ошибка загрузки дерева</div>';
  }
}

async function loadRecommendations() {
  try {
    const resp = await fetch('/api/scenarios/recommendations');
    const data = await resp.json();
    const container = document.getElementById('recommendations-list');

    if (data.success && data.recommendations && data.recommendations.length > 0) {
      let html = '';
      for (const rec of data.recommendations) {
        const prob = (rec.probability * 100).toFixed(0);
        html += `
          <div class="recommendation-item">
            <span class="priority ${rec.priority || 'medium'}">${rec.priority === 'high' ? '🔴' : '🟡'}</span>
            <span class="scenario">${rec.scenario || '—'}</span>
            <span class="prob">${prob}%</span>
            <span class="action">${rec.action || 'Рекомендация'}</span>
          </div>
        `;
      }
      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="loading">💡 Нет рекомендаций</div>';
    }
  } catch (e) {
    console.error('[Scenarios] Ошибка загрузки рекомендаций:', e);
  }
}

async function loadStats() {
  try {
    const resp = await fetch('/api/scenarios/status');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-scenarios').textContent = data.stats.totalScenarios || 0;
      document.getElementById('stat-categories').textContent = data.stats.categories || 0;
      document.getElementById('stat-last').textContent = data.stats.lastUpdate ? new Date(data.stats.lastUpdate).toLocaleString() : '—';
      if (data.stats.totalScenarios > 0) {
        document.getElementById('stat-probability').textContent = 'активно';
      }
    }
  } catch (e) { console.error('[Scenarios] Ошибка загрузки статистики:', e); }
}

async function loadScenarios() {
  try {
    const resp = await fetch('/api/scenarios/list?limit=20');
    const data = await resp.json();
    if (data.success && data.scenarios && data.scenarios.length > 0) {
      renderScenarios(data.scenarios);
      renderTree();
      loadRecommendations();
    }
  } catch (e) {
    console.error('[Scenarios] Ошибка загрузки сценариев:', e);
  }
}

// ============================================================
// КНОПКА КОПИРОВАНИЯ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  let text = `=== CRUCIX — ГЕНЕРАТОР СЦЕНАРИЕВ ===\n`;
  text += `Дата: ${new Date().toLocaleString()}\n\n`;
  text += `--- СТАТИСТИКА ---\n`;
  text += `Сценариев: ${document.getElementById('stat-scenarios').textContent}\n`;
  text += `Категорий: ${document.getElementById('stat-categories').textContent}\n`;

  text += `\n--- СЦЕНАРИИ ---\n`;
  document.querySelectorAll('.scenario-card').forEach(el => {
    const name = el.querySelector('.name')?.textContent || '—';
    const prob = el.querySelector('.prob')?.textContent || '—';
    const desc = el.querySelector('.desc')?.textContent || '—';
    text += `${prob}  ${name}\n   ${desc}\n`;
  });

  text += `\n--- РЕКОМЕНДАЦИИ ---\n`;
  document.querySelectorAll('.recommendation-item').forEach(el => {
    const scenario = el.querySelector('.scenario')?.textContent || '—';
    const prob = el.querySelector('.prob')?.textContent || '—';
    const action = el.querySelector('.action')?.textContent || '—';
    text += `${prob}  ${scenario} → ${action}\n`;
  });

  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/scenarios\n`;

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

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-generate').addEventListener('click', generateScenarios);
  document.getElementById('btn-refresh').addEventListener('click', function() {
    loadStats();
    loadRecommendations();
    loadScenarios();
  });

  // Загружаем сценарии при старте
  loadStats();
  loadScenarios();
});
