// ============================================================
// AI GATEWAY — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let currentProvider = 'openai';
let currentModel = 'gpt-4o';
let messages = [];

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

async function loadStats() {
  try {
    const resp = await fetch('/api/ai-gateway/stats');
    const data = await resp.json();
    if (data.success) {
      document.getElementById('stat-requests').textContent = data.stats.requests || 0;
      document.getElementById('stat-tokens').textContent = data.stats.tokens || 0;
      document.getElementById('stat-active').textContent = data.stats.activeProvider || '—';
      document.getElementById('stat-cache').textContent = data.stats.cacheSize || 0;
    }
  } catch (e) { console.error('[AI Gateway] Ошибка загрузки статистики:', e); }
}

async function loadProviders() {
  try {
    const resp = await fetch('/api/ai-gateway/models');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('providers-grid');
      let html = '';
      for (const [id, p] of Object.entries(data.models)) {
        const status = p.isConfigured ? (p.isActive ? 'online' : 'not_configured') : 'not_configured';
        const statusText = p.isConfigured ? (p.isActive ? '✅ Активен' : '⚪ Не активен') : '🔑 Нет ключа';
        html += `
          <div class="provider-card ${status}">
            <div class="name">${p.name}</div>
            <div class="status">${statusText}</div>
            <div class="models">${p.models.join(', ')}</div>
            ${p.isActive ? '<span class="badge badge-active">Активен</span>' : ''}
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) { console.error('[AI Gateway] Ошибка загрузки провайдеров:', e); }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const provider = document.getElementById('provider-select').value;
  const model = document.getElementById('model-select').value;

  messages.push({ role: 'user', content: text });
  renderMessages();

  input.value = '';
  const sendBtn = document.getElementById('chat-send');
  sendBtn.textContent = '⏳';

  try {
    const resp = await fetch('/api/ai-gateway/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, provider })
    });
    const data = await resp.json();

    if (data.success) {
      messages.push({ role: 'assistant', content: data.text });
      renderMessages();
      await loadStats();
    } else {
      messages.push({ role: 'system', content: `❌ Ошибка: ${data.error}` });
      renderMessages();
    }
  } catch (e) {
    messages.push({ role: 'system', content: `❌ Ошибка: ${e.message}` });
    renderMessages();
  } finally {
    sendBtn.textContent = '➤';
  }
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  let html = '';
  for (const msg of messages) {
    const cls = msg.role === 'user' ? 'user' :
                msg.role === 'assistant' ? 'assistant' :
                msg.role === 'system' ? 'system' : 'error';
    html += `<div class="message ${cls}">${msg.content}</div>`;
  }
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function clearChat() {
  messages = [];
  renderMessages();
  const container = document.getElementById('chat-messages');
  container.innerHTML = '<div class="message system">💬 Чат очищен. Напишите сообщение.</div>';
}

async function saveKey(provider) {
  const input = document.getElementById(`key-${provider}`);
  const key = input.value.trim();
  if (!key) { showNotification('⚠️ Введите API-ключ'); return; }

  try {
    const resp = await fetch('/api/ai-gateway/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey: key })
    });
    const data = await resp.json();
    if (data.success) {
      showNotification(`✅ Ключ для ${provider} сохранён`);
      input.value = '';
      await loadProviders();
    } else {
      showNotification(`❌ Ошибка: ${data.error}`);
    }
  } catch (e) {
    showNotification(`❌ Ошибка: ${e.message}`);
  }
}

async function clearCache() {
  try {
    const resp = await fetch('/api/ai-gateway/cache/clear', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification('✅ Кэш очищен');
      await loadStats();
    }
  } catch (e) {
    showNotification(`❌ Ошибка: ${e.message}`);
  }
}

async function healthCheck() {
  const container = document.getElementById('health-result');
  container.classList.add('visible');
  container.innerHTML = '⏳ Проверка провайдеров...';

  try {
    const resp = await fetch('/api/ai-gateway/health');
    const data = await resp.json();
    if (data.success) {
      let html = '';
      for (const [id, h] of Object.entries(data.health)) {
        const dot = h.status === 'online' ? 'online' :
                    h.status === 'offline' ? 'offline' :
                    h.status === 'not_configured' ? 'not_configured' : 'unknown';
        const statusText = h.status === 'online' ? '🟢 Онлайн' :
                          h.status === 'offline' ? '🔴 Офлайн' :
                          h.status === 'not_configured' ? '🟠 Нет ключа' : '⚪ Неизвестно';
        html += `<div class="health-item"><span class="dot ${dot}"></span>${h.name}: ${statusText}</div>`;
      }
      container.innerHTML = html;
    }
  } catch (e) {
    container.innerHTML = `❌ Ошибка: ${e.message}`;
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('chat-send').addEventListener('click', sendMessage);
  document.getElementById('chat-clear').addEventListener('click', clearChat);
  document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
  });

  document.getElementById('provider-select').addEventListener('change', function() {
    const provider = this.value;
    const modelSelect = document.getElementById('model-select');
    const models = {
      openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
      groq: ['llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
      deepseek: ['deepseek-chat', 'deepseek-reasoner']
    };
    modelSelect.innerHTML = (models[provider] || []).map(m => `<option value="${m}">${m}</option>`).join('');
  });

  document.getElementById('cache-toggle').addEventListener('change', async function() {
    try {
      await fetch('/api/ai-gateway/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheEnabled: this.checked })
      });
      showNotification(this.checked ? '✅ Кэширование включено' : '⛔ Кэширование выключено');
    } catch (e) {
      showNotification(`❌ Ошибка: ${e.message}`);
    }
  });

  loadStats();
  loadProviders();
  setInterval(loadStats, 30000);
});
