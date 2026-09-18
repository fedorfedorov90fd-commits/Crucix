// ============================================================
// СКРЫТЫЕ СВЯЗИ — КЛИЕНТСКАЯ ЛОГИКА
// ============================================================

let network = null;
let graphData = null;

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
  label.textContent = '⏳ Сбор данных...';
  label.className = 'status-label running';

  try {
    const resp = await fetch('/api/hidden-links/update', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showNotification(`✅ Обновлено: ${data.stats.totalEvents} событий, ${data.stats.totalLinks} связей`);
      await loadGraph();
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

async function loadGraph() {
  try {
    const resp = await fetch('/api/hidden-links/graph');
    const data = await resp.json();
    if (data.success) {
      graphData = data.graph;
      renderStats(data.stats);
      renderGraph(data.graph);
      loadTopLinks();
    }
  } catch (e) {
    console.error('[Hidden Links] Ошибка загрузки графа:', e);
    document.getElementById('graph-container').innerHTML = '<div class="loading">❌ Ошибка загрузки графа</div>';
  }
}

function renderStats(stats) {
  document.getElementById('stat-events').textContent = stats.totalEvents || 0;
  document.getElementById('stat-links').textContent = stats.totalLinks || 0;
  document.getElementById('stat-nodes').textContent = stats.nodes || 0;
  document.getElementById('stat-edges').textContent = stats.edges || 0;
}

function renderGraph(graph) {
  const container = document.getElementById('graph-container');

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    container.innerHTML = '<div class="loading">📭 Нет данных для графа</div>';
    return;
  }

  // Очищаем контейнер
  container.innerHTML = '';

  // Подготавливаем данные для vis-network
  const nodes = graph.nodes.map(n => ({
    id: n.id,
    label: n.label || n.id.slice(0, 20),
    color: n.color || '#6b7280',
    size: n.size || 8,
    font: { color: '#c8d0d8', size: 12 }
  }));

  const edges = graph.edges.map(e => ({
    from: e.source,
    to: e.target,
    width: Math.min(e.strength * 5 + 1, 8),
    color: { color: `rgba(255,255,255,${Math.min(e.strength * 0.6 + 0.2, 0.8)})` },
    title: `Сила: ${(e.strength * 100).toFixed(0)}%`
  }));

  const options = {
    nodes: {
      shape: 'dot',
      size: 10,
      font: { color: '#c8d0d8', size: 12 },
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)'
    },
    edges: {
      smooth: { type: 'continuous' },
      arrows: { to: { enabled: true, scaleFactor: 0.5 } }
    },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01 }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      navigationButtons: true
    }
  };

  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };

  if (network) {
    network.destroy();
  }

  network = new vis.Network(container, data, options);

  network.on('click', function(params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        showNotification(`🔍 ${node.label}`);
      }
    }
  });
}

async function loadTopLinks() {
  try {
    const resp = await fetch('/api/hidden-links/top?limit=10');
    const data = await resp.json();
    if (data.success) {
      const container = document.getElementById('top-links');
      if (data.links.length === 0) {
        container.innerHTML = '<div class="empty">Нет связей</div>';
        return;
      }
      let html = '';
      for (const link of data.links) {
        const strength = (link.strength * 100).toFixed(0);
        html += `
          <div class="top-link-item">
            <span class="strength">${strength}%</span>
            <span class="relation">
              <span class="source">${link.source.slice(0, 40)}</span>
              <span class="arrow">→</span>
              <span class="target">${link.target.slice(0, 40)}</span>
            </span>
            <span class="type">${link.type || 'cross'}</span>
          </div>
        `;
      }
      container.innerHTML = html;
    }
  } catch (e) {
    console.error('[Hidden Links] Ошибка загрузки топ связей:', e);
  }
}

// ============================================================
// КНОПКА КОПИРОВАНИЯ
// ============================================================
document.getElementById('copy-btn').addEventListener('click', function() {
  const data = {
    title: document.title,
    time: new Date().toLocaleString(),
    stats: {
      events: document.getElementById('stat-events').textContent,
      links: document.getElementById('stat-links').textContent,
      nodes: document.getElementById('stat-nodes').textContent,
      edges: document.getElementById('stat-edges').textContent
    },
    topLinks: []
  };

  document.querySelectorAll('.top-link-item').forEach(el => {
    const strength = el.querySelector('.strength')?.textContent || '—';
    const source = el.querySelector('.source')?.textContent || '—';
    const target = el.querySelector('.target')?.textContent || '—';
    data.topLinks.push({ strength, source, target });
  });

  let text = `=== ${data.title} ===\n`;
  text += `Дата: ${data.time}\n\n`;
  text += `--- СТАТИСТИКА ---\n`;
  text += `Событий: ${data.stats.events}\n`;
  text += `Связей: ${data.stats.links}\n`;
  text += `Узлов: ${data.stats.nodes}\n`;
  text += `Связей в графе: ${data.stats.edges}\n\n`;
  text += `--- ТОП СВЯЗЕЙ ---\n`;
  for (const link of data.topLinks) {
    text += `${link.strength}  ${link.source} → ${link.target}\n`;
  }
  text += `\n--- CRUCIX OSINT TERMINAL ---\n`;
  text += `🌐 http://localhost:3117/hidden-links\n`;

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
  document.getElementById('btn-update').addEventListener('click', updateData);
  document.getElementById('btn-refresh').addEventListener('click', loadGraph);

  // Загружаем начальные данные
  loadGraph();
});
